Vue.config.devtools = true

// Vue.use(Vuex)

// const store = new Vuex.Store({
//   state: {
//     settings: []
//   },
//   mutations: {
//     SET_SETTINGS(state, newSettings) {
//       state.settings = newSettings
//     }
//   },
//   actions:{
//   }
// })

var app = new Vue({
  el: '#app',
  delimiters: ["<%", "%>"],
  // store,
  data: {
    currentPage: 0,     // 0: HomePage, 1: CB GUI, 2: LLM GUI
    manageTab: false,  // false: CB page, true: manage page
    privilege: privilege,  // Whether current user is a superuser.
    default_cb: default_cb,
    IoTtalkURL: "",
    showLoading: false,
    newCBIcon: null,
    statusTrackWorker: -1,  // Timer ID for periodically calling current_data
    cbTrackWorker: -1,
    width: -1,
    newCB: "",
    newSA: {
      text: "",
      pinned: false
    },
    comparisons: [
      { value: "notset", text: "" },
      { value: "smaller", html: "&lt;" },
      { value: "bigger", html: "&gt;" }
    ],
    userlvls: [
      { value: 0, text: "User" },
      { value: 1, text: "Admin" }
    ],
    weekdays: [
      { value: 0, text: "Mon" },
      { value: 1, text: "Tue" },
      { value: 2, text: "Wen" },
      { value: 3, text: "Thu" },
      { value: 4, text: "Fri" },
      { value: 5, text: "Sat" },
      { value: 6, text: "Sun" },
      { value: 7, text: "All" }
    ],
    hours: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
    ],
    minutes: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
      15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
      30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
      45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
    ],
    seconds: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
      15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
      30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,
      45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
    ],
    users: [],
    controlboards: [],
    currentCB: {
      "value": 0
    },
    accessibleCBs: [],
    backupSettings: [],
    settings: [],
    providersData: null,
    selectedControlBoard: null,
    selectedProvider: "ollama",
    selectedModel: "llama3.3", 
    apiKey: "",
    chatInput: "",
    isChatButtonDisabled: false,
    needApiKey: true,
    isGoGUI: false,
    isGUIButton: false,
    chatContextType: "Choice",
    settingsForAssistant: null,
    deviceFeatures: [],
  },
  created: function () {
    // Procedures to correctly render data:
    // get CBs -> get Rules -> get Status
    this.width = window.innerWidth;
    window.addEventListener("resize", this.onWindowResize);
    this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
    axios
      .get("/subsystem/infos")
      .then((res) => {
        this.IoTtalkURL = res.data;
      })
      .catch((err) => {
        console.log(err);
      })

    // there are two strategy: local storage and postMessage, where postMessage is not available in this scenario.
    // ref: https://stackoverflow.com/questions/57503980/pass-data-between-components-in-a-new-tab
    var cb = window.localStorage.getItem("cb");
    if (cb !== null) {  // Create a new tab for the admin to view the CB Elements
      cb = JSON.parse(cb);
      this.controlboards = [cb];
      this.privilege = window.localStorage.getItem("privilege");
      this.currentCB = cb;
      this.selectedControlBoard = cb;
      this.currentPage = 1;
      this.isGoGUI = true;
      this.refreshRuleWorker();

      window.addEventListener("beforeunload", function () {
        // clear the cb stored in local storage
        window.localStorage.removeItem("cb");
        window.localStorage.removeItem("privilege");
      })

    } else {  // Main page
      if (this.privilege) {
        console.log("get user");
        this.getAllUsers()
          .then((users) => {
            this.users = users;
          })
          .catch((err) => {
            if (err.response.status != 403) {
              alert(err.response.data);
            }
          });
      }
      this.refreshCBWorker();  // Close call current_data when website opened
      this.cbTrackWorker = setInterval(this.cbTrackWorker, 60000);
    }
    this.getLLMConfigs()
        .then((data) => {
          console.log("ddddddddddddddd: ", data)
          this.providersData = data;
          for (let provider in this.providersData) {
            console.log("provider: ", provider);
            let api = this.providersData[provider].api_key;
            console.log("ttttttttttttttttt: ", this.providersData[provider])
            if (api === undefined) {
              api = window.localStorage.getItem(provider) || "";
              // console.log("gggggggggggeeeeeeeeeeeettttttt: ", api);
            }
            this.providersData[provider].api_key = api;
          }
          this.apiKey = this.providersData[this.selectedProvider].api_key;
        })
        .catch((err) => {
          console.log("Error: ", err);
        })
    return;
  },
  mounted: function() {
    if (typeof default_cb !== "undefined" && default_cb) {
      this.showLoading = true;
      if (this.privilege) {
        var req = "all";
      } else {
        var req = "self";
      }
      this.getAvailableCBs(req)
        .then((res) => {
          var cbList = res;
          var cb = cbList.find(cb => cb.text === default_cb);
          if (cb) {
            this.onRefreshCB(cb)
              .then((res) => {
                this.refreshCBWorker(cb);
                cb.status = true;
                window.localStorage.setItem("cb", JSON.stringify(cb));
                window.localStorage.setItem("privilege", this.privilege);
                window.localStorage.setItem("isGoLLM", true);
                window.location.href = "/";
                this.showLoading = false;
                return
              })
              .catch((err) => {
                console.log(err);
              })
          } else {
            alert("ControlBoard not found");
            this.showLoading = false;
            window.location.href = "/"
          }
        })
        return;
    }
    isGoLLM = window.localStorage.getItem("isGoLLM") === 'true';

    console.log("gogogogogogo main.js 192:", isGoLLM);
    if (isGoLLM) {
      this.currentPage = 2;
      window.localStorage.removeItem("isGoLLM");
    }
  },
  computed: {
    maxPinnedCBs: function () {
      return Math.floor(this.width / 80) - 1;
    },
    hasIncompleteCBs: function () {
      var status = false;
      this.controlboards.forEach((cb) => {
        if (!cb.status) {
          status = true;
        }
      });
      return status;
    }
  },
  watch: {
    selectedProvider(provider) {
      this.selectedModel = this.providersData[provider].models[0];
      this.apiKey = this.providersData[provider].api_key;
      this.needApiKey = this.providersData[provider].need_api_key;
    }
  },
  methods: {
    /* API data getter Methods, including CB, SA, Rule, Status, User, 
    *  Reachable Project
    */
    projectURL: function (cb) {
      return this.IoTtalkURL.concat(cb);
    },
    goHome: function() {
      this.currentPage = 0;
      window.localStorage.removeItem("cb");
      window.location.href = "/";
    },
    makeToast(variant, title, body) {
      this.$bvToast.toast(body, {
        title: title,
        variant: variant,
        solid: true,
        autoHideDelay: 5000,
      });
    },
    getAvailableCBs: function (account) {
      return new Promise(function (resolve, reject) {
        axios
          .get("/cb/get_cb/" + account)
          .then(function (res) {
            res.data.sort((a, b) => b.value - a.value);
            resolve(res.data);
          })
          .catch(function (err) {
            reject(err);
          });
      });
    },
    getCBRules: function (cbID) {
      return new Promise(function (resolve, reject) {
        axios
          .get("/cb/" + cbID.toString() + "/rules")
          .then((rules) => {
            rules.data.sort((a, b) => {
              actuator1 = a.actuator.toUpperCase();
              actuator2 = b.actuator.toUpperCase();
              if (actuator1 < actuator2) {
                return -1;
              } else if (actuator1 > actuator2) {
                return 1;
              } else {
                return 0;
              }
            })
            resolve(rules.data);
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
    getRuleStatus: function (cbID) {
      return new Promise(function (resolve, reject) {
        axios
          .get("/cb/" + cbID.toString() + "/current_data")
          .then((status) => {
            resolve(status.data);
          })
          .catch((err) => {
            reject(err);
          });
      });
    },
    getAllUsers: function () {
      return new Promise(function (resolve, reject) {
        axios
          .get("/account/get_accounts")
          .then((res) => {
            res.data.sort((a, b) => b.superuser - a.superuser);
            resolve(res.data);
          })
          .catch((err) => {
            reject(err);
          })
      })
    },
    getLLMConfigs: function () {
      return new Promise(function (resolve, reject) {
        axios
          .get("/llm/config")
          .then((res) => {
            resolve(res.data);
          })
          .catch((err) => {
            reject(err);
          })
      })
    },
    /* Refresh routine procedures, including CB, SA, Rule, Status */
    refreshCBWorker: function (next_currentCB) {
      if (this.privilege) {
        var req = "all";
      } else {
        var req = "self";
      }
      this.getAvailableCBs(req)
        .then((controlboards) => {
          this.controlboards = controlboards;
          if (controlboards.length === 0) {
            this.currentCB = {
              "value": 0,
              "status": true
            };
          } else {
            this.selectedControlBoard = this.currentCB || this.controlboards[0];
          }
          if (next_currentCB !== undefined) {
            controlboards.forEach((cb) => {
              if (cb.text === next_currentCB.text) {
                this.currentCB = cb;
              }
            })
          }
          else if (controlboards.length) {
            this.currentCB = controlboards[0];
          }
          //if (controlboards.length !== 0) {
          //  this.refreshRuleWorker();
          //}
        })
        .catch((err) => {
          console.log(err);
          if (err.response.status != 403) {
            alert(err.response.data);
          }
          this.showLoading = false;
          window.location = "/";
        })
    },
    refreshSAWorker: function () {
      this.getAvailableSAs(this.currentProject)
        .then((fields) => {
          this.setupFields(fields);
          this.refreshRuleWorker();
        })
        .catch((err) => {
          if (err.response) {
            alert(err.response.data);
          }
          window.location = "/";
        })
    },
    refreshRuleWorker: function () {
      this.getCBRules(this.currentCB.value)
        .then((rules) => {
          console.log("🚀 ~ file: main.js ~ line 269 ~ .then ~ rules", rules)
          this.backupSettings = JSON.parse(JSON.stringify(rules));
          new_rules = [];
          rules.forEach((rule) => {
            // Transform dutyPos and dutyNeg seconds to [hours, minutes, seconds]
            var h = ~~(rule.content.dutyPos / 3600);  // hours
            var m = ~~((rule.content.dutyPos - h * 3600) / 60);  // minutes
            var s = rule.content.dutyPos - h * 3600 - m * 60;  // seconds
            rule.content.dutyPosStamp = [h, m, s];

            h = ~~(rule.content.dutyNeg / 3600);  // hours
            m = ~~((rule.content.dutyNeg - h * 3600) / 60);  // minutes
            s = rule.content.dutyNeg - h * 3600 - m * 60;  // seconds
            rule.content.dutyNegStamp = [h, m, s];

            new_rules.push(rule);
            console.log("🚀 ~ file: main.js ~ line 285 ~ .then ~ new_rules", new_rules)
          })
          this.settings = new_rules;
          if (this.settings.length == 0 && this.isGoGUI) {
            this.currentPage = 2;
            this.isGoGUI = false;
          } 
          this.refreshStatusWorker();
        })
        .catch((err) => {
          console.log(err);
          if (err.response) {
            alert(err.response.data);
          }
          // window.location = "/";
        })
    },
    refreshStatusWorker: function () {
      if (this.settings.length) {
        this.getRuleStatus(this.currentCB.value)
          .then((status) => {
            this.setupRuleStatus(status);
          })
          .catch((err) => {
            // console.log(err);
            // if (err.response.status != 403) {
            //   alert(err.response.data);
            //   window.location = "/";
            // }
          });
      }
      return;
    },
    /* API data parser for ControlBoard and Status*/
    setupFields: function (fields) {
      fields.sort((a, b) => b.value - a.value);
      pinnedFieldObjects = [];
      this.pinnedFields = [];
      fields.forEach(element => {
        if (element.pin) {
          pinnedFieldObjects.push(element);
          this.pinnedFields.push(element.value)
        }
      });
      this.fields = {
        "pinnedFields": pinnedFieldObjects,
        "optionFields": fields
      };
      if (fields.length) {
        if (pinnedFieldObjects.length) {
          this.currentField = pinnedFieldObjects[0].value;
        } else {
          this.currentField = fields[0].value;
        }
      } else {
        this.currentField = 0;
      }
      console.log(this.fields);
    },
    setupRuleStatus: function (status) {
      this.settings.forEach(setting => {
        setting["time"] = status[setting.ruleID]["time"];
        setting["prevTrigger"] = status[setting.ruleID]["prev_trigger"];
        setting["value"] = status[setting.ruleID]["value"];
        setting["status"] = status[setting.ruleID]["status"] === "RED" ? true : false;
      });
      return;
    },
    goCBGUI: function (cb) {
      this.showLoading = true;
      this.onRefreshCB(cb)
        .then((res) => {
          this.refreshCBWorker(cb);
          cb.status = true;
          window.localStorage.setItem("cb", JSON.stringify(cb));
          window.localStorage.setItem("privilege", this.privilege);
          this.showLoading = false;
          window.localStorage.setItem("settings", this.controlboards);
          window.location.href = "/";
        })
        .catch((err) => {
          if (err.response.status === 400) {
            window.open(this.projectURL(cb.text));
          } else {
            console.log(err);
          }
          this.showLoading = false;
        })
    },
    goLLMGUI: function (cb) {
      this.currentPage = 2;
      this.selectedControlBoard = cb;
      this.chatContextType = "Choice";

      fetch(`/project/infos/${cb.text}`, { method: "GET" })
        .then(response => response.json())
        .then(result => {
          if (result.result.na.length >= 11) {
            this.isGUIButton = true;
          }

        })
        .catch(error => {
          console.error("Error:", error)
        })
      
    },
    onSwitchManageTab: function () {
      this.manageTab = !this.manageTab;
      return;
    },
    onSwitchCB: function (selected) {
      console.log('🚀 ~ file: main.js:403 ~ onSwitchCB', selected)
      window.clearInterval(this.statusTrackWorker);
      this.statusTrackWorker = -1;
      this.currentCB = selected;
      this.refreshRuleWorker();
      this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
      return;
    },
    onSelectProject: function (selected) {
      window.clearInterval(this.statusTrackWorker);
      this.statusTrackWorker = -1;
      this.currentProject = selected;
      this.manageTab = false;
      this.refreshSAWorker()
      this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
      return;
    },
    /* CB(Project) related procedures 
    *  including create / delete / pin field
    */
    onCBCreate: function (action) {
      console.log(action);
      if (1 === action) {
        this.showLoading = true;
        axios
          .post("/cb/create_cb", this.newCB)
          .then((res) => {
            console.log("Response of creating CB", res);
            this.refreshCBWorker();
            this.showLoading = false;
            window.location = "/";
            window.open(this.projectURL(this.newCB)).focus();
            this.newCB = "";
          })
          .catch(function (err) {
            if (err.response) {
              alert(err.response.data);
            }
          });
      }
      return;
    },
    onCBDelete: function (cbID, action) {
      if (1 === action) {
        this.showLoading = true;
        axios
          .post("/cb/delete_cb", cbID)
          .then((res) => {
            this.showLoading = false;
            window.location = "/";
            window.clearInterval(this.statusTrackWorker);
            this.statusTrackWorker = -1;
            this.refreshCBWorker();
          })
          .catch(function (err) {
            if (err.response) {
              alert(err.response.data);
            }
          });
      }
    },
    onCBConfig: function (cb) {
      axios
        .put("/cb/disable_cb/" + cb.value.toString())
        .then(() => {
          this.onSAReset();
          window.setTimeout(() => { window.open(this.projectURL(cb.text)) }, 2000);
        })
        .catch((err) => {
          console.log(err.response);
        })
    },
    /* SA(Field) related procedures 
    *  including create / delete / refresh / confirm / reset / undo / Resize pinned SA
    */
    onSACreate: function (action) {
      if (1 === action) {
        window.clearInterval(this.statusTrackWorker);
        this.statusTrackWorker = -1;
        data = {
          "sa": this.newSA,
          "cb_id": this.currentProject
        }
        axios
          .post("/sa/create_sa", data)
          .then((res) => {
            console.log(res);
            this.refreshSAWorker();
            this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
          })
          .catch((err) => {
            alert(err.response.data);
          })
      }
      this.newSA = {
        text: "",
        pinned: false
      };
      return;
    },
    onSADelete: function (action) {
      if (1 === action) {
        window.clearInterval(this.statusTrackWorker);
        this.statusTrackWorker = -1;
        axios
          .post("sa/delete_sa", this.currentField)
          .then((res) => {
            console.log(res);
            this.refreshSAWorker();
            this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
          })
          .catch((err) => {
            if (err.response) {
              alert(err.response.data);
            }
          })
      }
    },
    onSAConfirm: function () {
      console.time('onSAConfirm');
      console.log("confirm");
      window.clearInterval(this.statusTrackWorker);
      this.statusTrackWorker = -1;
      this.onSettingSaveChange(() => {
        console.timeEnd('onSAConfirm');
      });
      this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
      this.makeToast('success', "Success", "成功儲存配置");
      return;
    },    
    onSAReset: function () {
      window.clearInterval(this.statusTrackWorker);
      this.statusTrackWorker = -1;
      this.settings.forEach((setting, index) => {
        setting["mode"] = "OFF";
        setting["content"]["closeTimer"] = [0,0,0];
        setting["content"]["openTimer"] = [0,0,0];
        setting["content"]["dutyNeg"] = 0;
        setting["content"]["dutyPos"] = 0;
        setting["content"]["dutyNegStamp"] = [0,0,0];
        setting["content"]["dutyPosStamp"] = [0,0,0];
        setting["content"]["weekdays"] = [];
        
        // sensor reset
        setting["sensors"].forEach((sensor_data) => {
          sensor_data["closeSensor"] = "notset";
          sensor_data["closeSensorVal"] = 0;
          sensor_data["openSensor"] = "notset";
          sensor_data["openSensorVal"] = 0;
          sensor_data["operation"] = "AND";
        });
      });
      this.onSettingSaveChange();
      this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
      return;
    },
    onSettingSaveChange: function () {
      console.time('onSettingSaveChange');
      toChange = [];
      this.settings.forEach((setting, idx) => {
        var sensetting = [];
        setting["sensors"].forEach((elem, index) => {
          sensetting.push({
            "sensor_index": elem["selectedSensor"],
            "threshold_open": elem["openSensorVal"],
            "threshold_close": elem["closeSensorVal"],
            "comparison_open": elem["openSensor"],
            "comparison_close": elem["closeSensor"],
            "sensor_alias": elem["sensorName"],
            "operation": elem["operation"],
            "is_show_operation": elem["is_show_operation"]
          });
        });
        toChange.push({
          "rule_id": setting["ruleID"],
          "actuator_alias": setting["actuator"],
          "mode": setting["mode"],
          // "sensor_index": setting["selectedSensor"],
          // "threshold_open": setting["content"]["openSensorVal"],
          // "threshold_close": setting["content"]["closeSensorVal"],
          // "comparison_open": setting["content"]["openSensor"],
          // "comparison_close": setting["content"]["closeSensor"],
          "time_open": setting["content"]["openTimer"],
          "time_close": setting["content"]["closeTimer"],
          "weekday": setting["content"]["weekdays"],
          "duty_pos": setting["content"]["dutyPos"],
          "duty_neg": setting["content"]["dutyNeg"],
          "sensors": sensetting
        });
      });
      console.log('🚀 ~ file: main.js:622 ~ toChange', toChange)
    
      console.time('axiosPost'); // 开始计时
      axios.post("/cb/" + this.currentCB.value.toString() + "/new_rules", toChange)
        .then((msg) => {
          window.clearInterval(this.statusTrackWorker);
          this.statusTrackWorker = -1;
          console.log(msg);
          this.refreshRuleWorker();
          this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
        })
        .catch((err) => {
          if (err.response) {
            alert(err.response.data);
          }
        })
        .finally(() => {
          console.timeEnd('axiosPost'); // 结束计时并打印执行时间
          console.timeEnd('onSettingSaveChange'); // 结束计时并打印执行时间
        });
      return;
    },    
    /*
    onManualChange: function (ruleIdx) {
      // not done!!! copied above 
      // see component.js onSelectMode this.$emit("update-mode", nextMode);
      // to call this func at component.js b-form-checkbox
      // put this func in main.js's onSelectMode case0 and case1 only
      toChange = [];
      ruleIdx.forEach(idx => {
        var setting = this.settings[idx];
        setting["dirty"] = false;
        toChange.push({
          "rule_id": setting["ruleID"],
          "actuator_alias": setting["actuator"],
          "mode": setting["mode"],
          "sensor_index": setting["selectedSensor"],
          "threshold_open": setting["content"]["openSensorVal"],
          "threshold_close": setting["content"]["closeSensorVal"],
          "comparison_open": setting["content"]["openSensor"],
          "comparison_close": setting["content"]["closeSensor"],
          "time_open": setting["content"]["openTimer"],
          "time_close": setting["content"]["closeTimer"],
          "weekday": setting["content"]["weekdays"],
          "duty_pos": setting["content"]["dutyPos"],
          "duty_neg": setting["content"]["dutyNeg"]
        });
      });
      console.log(toChange);

      axios.post("/cb/" + this.currentCB.value.toString() + "/new_rules", toChange)
        .then((msg) => {
          window.clearInterval(this.statusTrackWorker);
          this.statusTrackWorker = -1;
          console.log(msg);
          this.refreshRuleWorker();
          this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
        })
        .catch((err) => {
          if (err.response) {
            alert(err.response.data);
          }
        })
      return;
    },
    */
    onRefreshCB: function (cb) {
      return new Promise((resolve, reject) => {
        console.log(this.currentCB);
        console.log(cb);
        window.clearInterval(this.statusTrackWorker);
        this.statusTrackWorker = -1;
        if (cb === undefined) {
          value = this.currentCB.value;
        } else {
          value = cb.value
        }
        axios
          .get("/cb/refresh_cb/" + value.toString())
          .then((res) => {
            this.statusTrackWorker = setInterval(this.refreshStatusWorker, 1000);
            resolve(res);
          })
          .catch((err) => {
            if (err.response) {
              const data = err?.response?.data || {};
              const errorMsg = data.msg || data.message || 'Unknown error';
              this.makeToast('danger', 'Error', errorMsg);
              this.showLoading = false;
              this.$nextTick(() => {
                setTimeout(() => {
                  window.location.href = "/";
                }, 3000);
              });
            } else {
              console.log("Network Error", err.message);
            }
            reject(err);
          })
      })
    },
    onSettingUndoChange: function (settingIndex) {
      this.$set(this.settings, settingIndex,
        JSON.parse(JSON.stringify(this.backupSettings[settingIndex])));
      this.settings[settingIndex]["dirty"] = false;
      console.log(this.settings[settingIndex]);
      return;
    },
    onWindowResize: function () {
      this.width = window.innerWidth * 0.98;
      return;
    },
    /* Rule related procedures 
    *  including selecting mode / which sensor to use /  comparison method / Timing / Calculate Duty Cycle Stage.
    */
    onSelectSensor: function (selected, ruleID) {
      console.log(selected, ruleID);
      this.settings.forEach((setting) => {
        if (setting.ruleID === ruleID) {
          setting.dirty = true;
          setting.selectedSensor = selected;
          return;
        }
      })
    },
    onSelectMode: function (nextMode, settingIndex) {
      console.log(nextMode);
      this.$set(this.settings[settingIndex], "dirty", true);
      if (nextMode === undefined || settingIndex === undefined) return;
      switch (nextMode) {
        case 0: // OFF
          if (this.settings[settingIndex].mode !== "OFF") {
            this.$set(this.settings[settingIndex], "mode", "OFF");
          }
          break;
        case 1:
          if (this.settings[settingIndex].mode !== "ON") {
            this.$set(this.settings[settingIndex], "mode", "ON");
          }
          break;
        case 2: // Sensor mode
          if (this.settings[settingIndex].mode !== "Sensor") {
            this.$set(this.settings[settingIndex], "mode", "Sensor");
          }
          break;
        case 3: // Timer mode
          if (this.settings[settingIndex].mode !== "Timer") {
            this.$set(this.settings[settingIndex], "mode", "Timer");
          }
          break;
        default:
          console.log("Unsupported Input mode");
          break;
      }
      console.log(this.settings[settingIndex]);
      return;
    },
    onSelectCompare: function (val, settingIndex, content) {
      console.log(val, settingIndex, content);
      this.settings[settingIndex].dirty = true;
      if (content === "open") {
        this.settings[settingIndex].content.openSensor = val;
      } else {
        this.settings[settingIndex].content.closeSensor = val;
      }
    },
    onSelectTime: function (val, settingIndex, content) {
      console.log(val, settingIndex, content);
      this.settings[settingIndex].dirty = true;
      if (content < 3) {
        this.settings[settingIndex].content.openTimer[content] = val;
      } else {
        this.settings[settingIndex].content.closeTimer[content - 3] = val;
      }
    },
    onSelectTimeStamp: function (val, settingIndex, content) {
      //  time to timeStamp
      console.log(val, settingIndex, content);
      this.settings[settingIndex].dirty = true;
      if (content < 3) {
        this.settings[settingIndex].content.dutyPosStamp[content] = val;
      } else {
        this.settings[settingIndex].content.dutyNegStamp[content - 3] = val;
      }
      // compute dutyPos
      if (content < 3) {
        var h = this.settings[settingIndex].content.dutyPosStamp[0];
        var m = this.settings[settingIndex].content.dutyPosStamp[1];
        var s = this.settings[settingIndex].content.dutyPosStamp[2];
        console.log(h, m, s);
        this.settings[settingIndex].content.dutyPos = h * 3600 + m * 60 + s;
        console.log(this.settings[settingIndex].content.dutyPos);
      } else {
        var h = this.settings[settingIndex].content.dutyNegStamp[0];
        var m = this.settings[settingIndex].content.dutyNegStamp[1];
        var s = this.settings[settingIndex].content.dutyNegStamp[2];
        console.log(h, m, s);
        this.settings[settingIndex].content.dutyNeg = h * 3600 + m * 60 + s;
        console.log(this.settings[settingIndex].content.dutyNeg);
      }
    },
    onSelectWeekdays: function (event, settingIndex) {
      console.log(event, settingIndex);
      console.log(this.settings[settingIndex].content.weekdays);
      this.settings[settingIndex].dirty = true;
      inputSelectAll = (event.indexOf(7) >= 0);
      dataSelectAll = (this.settings[settingIndex].content.weekdays.indexOf(7) >= 0);
      tempArr = [];
      if (dataSelectAll && event.length <= 7) {
        event.forEach(element => {
          if (element !== 7) {
            tempArr.push(element);
          }
        });
      } else {
        if (inputSelectAll) {
          for (i = 0; i < 8; i++) {
            tempArr.push(i);
          }
        } else {
          event.forEach(element => {
            tempArr.push(element);
          });
        }
      }
      this.$set(this.settings[settingIndex].content, "weekdays", tempArr);
      return;
    },
    onJudgeDutyCycle: function (setting) {
      if (setting.prevTrigger === -10000) {
        return "";
      }
      if (setting.status) {
        return "POS";
      } else {
        return "NEG";
      }
    },
    lvlToText: function (userLvl) {
      if (userLvl === 1) {
        return "Admin";
      } else {
        return "User";
      }
    },
    onSelectUserLvl: function (event, userIndex) {
      this.users[userIndex].superuser = event;
      return;
    },
    onUserUpdate: function (index, action) {
      if (1 === action) {
        data = {
          "privilege": this.users[index].superuser,
          "accessible_cb": this.accessibleCBs
        };
        axios.post("/account/adjust_privilege/" + this.users[index].email, data)
          .then((res) => {
            console.log(res);
            this.getAllUsers()
              .then((usrs) => {
                this.users = usrs;
              })
              .catch((err) => {
                if (err.response.status != 403) {
                  alert(err.response.data);
                }
              });
            this.refreshCBWorker();
          })
          .catch((err) => {
            if (err.response) {
              alert(err.response.data);
            }
          });
      }
    },
    onAccessibleCB: function (userName) {
      this.getAvailableCBs(userName)
        .then((cbs) => {
          this.accessibleCBs = [];
          cbs.forEach((cb) => {
            this.accessibleCBs.push(cb.value);
          });

        })
        .catch((err) => {
          if (err.response) {
            alert(err.response.data);
          }
        })
    },
    onLogout: function () {
      axios
        .put("/account/logout")
        .then((res) => {
          console.log("logout succeeded");
          window.location = "/";
        })
        .catch((err) => {
          if (err.response.status != 403)
            console.log("logout failed");
        })
    },
    async createNAMode() {
      this.chatContextType = "CreateNA";
      
      try {
        const response = await fetch("/llm/get_device_features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cb_name: this.selectedControlBoard?.text ?? null,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.deviceFeatures = data.data;
      } catch (err) {
        console.error("createNAMode 發生錯誤", err);
      }
    },
    async deleteNAMode() {
      this.chatContextType = "DeleteNA";

      try {
        const response = await fetch("/llm/get_rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cb_name: this.selectedControlBoard?.text ?? null,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.settingsForAssistant = data.data;
      } catch (err) {
        console.error("deleteNAMode 發生錯誤", err);
      }
    },
    onBracketClick(setting, index) {
      fetch("/llm/remove_na", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setting: setting,
          cb_id: this.selectedControlBoard ? this.selectedControlBoard.value : null,
        }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(error => {
            this.makeToast('danger', "Error", error.error);
          });
        } else {
          this.makeToast('success', "Success", "成功刪除連接線");
          this.settingsForAssistant.splice(index, 1);
        }
      })
      .catch(err => {
        this.makeToast('danger', "Error", err.message);
      });
    },
    onApiKeyInput() {
      this.providersData[this.selectedProvider].api_key = this.apiKey;
      window.localStorage.setItem(this.selectedProvider, this.apiKey);
    },
    async submitChat() {
      const content = this.chatInput;
      if (!content) {
        console.log("No content to send");
        this.makeToast('danger', "Error", "Missing required field: message");
        return;
      }
      this.isChatButtonDisabled = true;
      const response = await fetch("/llm/cb_agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlboard: this.selectedControlBoard ? this.selectedControlBoard.text : null,
          provider: this.selectedProvider,
          api_key: this.apiKey,
          user_input: this.chatInput,
          model: this.selectedModel,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        this.makeToast('danger', "Error", error.error);
      } else {
        this.makeToast('success', "Success", "成功完成配置");
        this.isGUIButton = true;
      }
      this.chatInput = "";
      this.isChatButtonDisabled = false;
    },
    // onUpdateSensorCod({ ruleID, data }) {
    //   // TODO
    //   //   sensorCod:{
    //   //     comparisonOpen: '',
    //   //     comparisonOpenInput: '',
    //   //     comparisonClose: '',
    //   //     comparisonCloseInput: '',
    //   // }
    //   const index = this.settings.findIndex((item) => {
    //     return item.ruleID === ruleID;
    //   });
    //   console.log(index);
    //   // console.log(ruleID,data)
    //   this.settings[index].content.openSensor = data.comparisonOpen;
    //   this.settings[index].content.openSensorVal = data.comparisonOpenInput;
    //   this.settings[index].content.closeSensor = data.comparisonClose;
    //   this.settings[index].content.closeSensorVal = data.comparisonCloseInput;

    // }
  },
})

