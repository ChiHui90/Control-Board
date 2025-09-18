Vue.component('custom-sel', {
    props: ['options', 'select', 'status'],
    methods:{
        onChange(val) {
            this.$emit("update-option", val);
        }
    },
    template: /*html*/`
        <b-form-select required size="sm" class="custom-select"
            :options="options"
            @change="onChange"
            :value="select"
            :disabled="!status"
        ></b-form-select>
    `
})

Vue.component('custom-sel-sensor-comparison', {
    props: ['select', 'options', 'status'],
    computed: {
        selectValue: {
            get(){
                return this.select
            },
            set(val){
                this.$emit('update:select', val)
            },
        }
    },
    template: /*html*/`
        <b-form-select required size="sm" class="custom-select"
            :options="options"
            :disabled="!status"
            v-model="selectValue"
        ></b-form-select>
    `
})


Vue.component('actuator-row', {
    props: ['actuator', 'status'],
    template: /*html*/`
        <b-row v-bind:class="['element-status', status?'triggered':'']" class="text-left">
            <b-col align-self="start" text-align="start" class="pl-0">
                <b-dropdown class="one-item-dropdown"
                    v-bind:text="actuator" v-bind:variant="status?'danger':'success'"
                ></b-dropdown>
            </b-col>
        </b-row>
    `
})

Vue.component('sensor-row', {
    props: ['mode', 'sensor', 'value', 'dirty'],
    data: function() {
        return {
            state: (this.mode==="ON")? true: false
        }
    },
    methods: {
        onSelectMode: function(nextMode) {
            if (0 === nextMode && true === this.state) {
                nextMode += 1;
            }
            this.$emit("update-mode", nextMode);
            return;
        }
    },
    template: /*html*/`
        <b-row class="text-left sensor-list">
            <b-col>
                <b-button-group>
                    <b-button size="md" variant="outline-success"
                        v-bind:pressed="mode==='ON' || mode==='OFF'"
                    >
                        <b-form-checkbox switch
                            v-model="state"
                            v-on:input="onSelectMode(0)"
                        >Manual</b-form-checkbox>
                    </b-button>
                    <b-button variant="outline-success"
                        v-bind:pressed="mode==='Timer'"
                        v-on:click="onSelectMode(3)"
                    >Timer</b-button>
                    <b-button variant="outline-success" 
                        v-bind:pressed="mode==='Sensor'"
                        v-on:click="onSelectMode(2)"
                    >Sensor</b-button>
                </b-button-group>
            </b-col>
            <!-- <span class="ml-auto mr-1"><b>{{value}}</b></span> -->
        </b-row>
    `
})

Vue.component('sensor-condition-row', {
    props: {
        comparisons: {
            type: Array
        },
        currentCb: {
            type: Object
        },
        onSelectCompare: {
            type: Function
        },
        sensor:{
            type: Object
        },
        value:{
            type: Object
        }
    },
    methods: {
        onClickOperator: function() {
            this.sensor.operation = (this.sensor.operation === "AND") ? "OR" : "AND";
        },
    },
    data(){
        return{
            sensorCod:{
                comparisonOpen: '',
                comparisonOpenInput: '',
                comparisonClose: '',
                comparisonCloseInput: '',
            }
        }
    },
    template: /*html*/`
        <div>
            <div class="card border-dark" style="margin-bottom: 20px;">
                <div class="card-header d-flex">
                    <!-- {{sensor}} {{sensor.selectedSensor}} -->
                    {{sensor.sensorName}} 
                    <span class="ml-auto mr-1"><b>{{ value[sensor.selectedSensor] }}</b></span>
                </div>
                <div class="card-body">
                    <div class="setting-sensor">
                        <custom-sel-sensor-comparison
                            :options="comparisons"
                            :status="currentCb.status"
                            :select.sync="sensor.openSensor"
                        ></custom-sel-sensor-comparison>
                        <b-form-input size="sm" class="custom-input"
                            v-model="sensor.openSensorVal"
                        ></b-form-input>
                        <span class="setting-text-mid">ON.</span>
                        <custom-sel-sensor-comparison
                            :options="comparisons"
                            :status="currentCb.status"
                            :select.sync="sensor.closeSensor"
                        ></custom-sel-sensor-comparison> 
                        <b-form-input size="sm" class="custom-input"
                            v-model="sensor.closeSensorVal"
                        ></b-form-input>
                        <span class="setting-text">OFF.</span>
                    </div>
                </div>
            </div>
            <div v-if="sensor.is_show_operation" style="margin-bottom: 20px;">
                <b-button @click="onClickOperator">{{ sensor.operation }}</b-button>
                <!-- <p>Pressed State: <strong>{{ sensor.operation }}</strong></p> -->
            </div>
        </div>
    `
})


Vue.component('project', {
    props: ['field'],
    methods: {
        onSelectCB: function() {
            this.$emit("selectCB");
            return;
        }
    },
    template: /*html*/`
        <b-dropdown-item
            v-on:click="onSelectCB"
        >   <b-img v-bind:src="field.icon"></b-img>
            {{field.text}}
        </b-dropdown-item>
    `
})

Vue.component('select-projects', {
    props: ['projects', 'selected'],
    methods: {
        onSelectCB: function(projectIndex) {
            this.$emit("select-project", projectIndex);
            return;
        },
        onShow: function(bvEvent) {
            if (this.projects.length <= 1) {
                bvEvent.preventDefault();
            }
            return;
        }
        
    },
    computed: {
        candicateProjects: function() {
            candicate = [];
            this.projects.forEach(element => {
                if (element.value !== this.selected) {
                    candicate.push(element);
                }
            });
            return candicate;
        },
        selectedProject: function() {
            selected = {
                "icon": "", "text": "", value: -1
            };
            this.projects.forEach(element => {
                console.log(element);
                if (element.value === this.selected) {
                    selected = element;
                }
            });
            return selected;
        }
    },
    template: /*html*/`
        <div>
            <b-navbar-nav>
                <b-nav-item-dropdown v-on:toggle="$emit('pressed')" v-on:show="onShow">
                    <template v-slot:button-content v-if="projects.length!==0">
                        <b-img v-bind:src="selectedProject.icon"></b-img>
                        {{selectedProject.text}}
                    </template>
                    <template v-slot:button-content v-else>
                        Add ControlBoard
                    </template>
                    <project 
                        v-for="field in candicateProjects"
                        v-bind:field="field"
                        v-on:selectCB="onSelectCB(field.value)"
                        v-if="projects.length > 1"
                    ></project>
                </b-nav-item-dropdown>
            </b-navbar-nav>
        </div>
    `
})

Vue.component('BracketTree', {
  props: {
    children: { type: Array, required: true }, 
    root: { type: String, required: true },    
    rowGap: { type: Number, default: 40 },     
    rightGap: { type: Number, default: 40 }    
  },
  data() {
    return {
      leftMargin: 40,     
      midX: 100,         
      rootExtra: 80,    
      verticalPadding: 0   
    };
  },
  computed: {
    svgHeight() {
      
      if (this.children.length === 1) {
        return 20; 
      }
      return (this.children.length - 1) * this.rowGap + 20;
    },
    svgWidth() {
      return this.leftMargin + this.midX + this.rightGap + this.rootExtra;
    },
    midY() {
      if (this.children.length === 1) {
        return 10; 
      }
      return (this.children.length - 1) * this.rowGap / 2 + 10;
    }
  },
  methods: {
    childY(i) {
      return i * this.rowGap + 10; // 10 是文字基线调整
    },
    adjustTextMargins() {
      this.$nextTick(() => {
        const leftTexts = this.$el.querySelectorAll('text[data-side="left"]');
        let maxLeft = 0;
        leftTexts.forEach(t => {
          const w = t.getBBox().width;
          if (w > maxLeft) maxLeft = w;
        });
        this.leftMargin = maxLeft + 20;
        const rightText = this.$el.querySelector('text[data-side="right"]');
        if (rightText) {
          const w = rightText.getBBox().width;
          this.rootExtra = w + 20; // 多預留 20px
        }
      });
    }
  },
  mounted() {
    this.adjustTextMargins();
  },
  updated() {
    this.adjustTextMargins();
  },
  template: /*html*/`
  <div class="bracket-tree" style="overflow-x:auto;">
    <svg :width="svgWidth" :height="svgHeight" style="overflow:visible;">
      <!-- 子節點水平線 -->
      <line
        v-for="(child, i) in children"
        :key="'h'+i"
        :x1="leftMargin"
        :y1="childY(i)"
        :x2="leftMargin + midX"
        :y2="childY(i)"
        stroke="#3b82f6" stroke-width="2"
      />
      <!-- 垂直線 -->
      <line
        v-if="children.length>1"
        :x1="leftMargin + midX"
        :x2="leftMargin + midX"
        :y1="childY(0)"
        :y2="childY(children.length-1)"
        stroke="#3b82f6" stroke-width="2"
      />
      <!-- 根節點右側水平線 -->
      <line
        :x1="leftMargin + midX"
        :y1="midY"
        :x2="leftMargin + midX + rightGap"
        :y2="midY"
        stroke="#3b82f6" stroke-width="2"
      />
      <!-- 子節點文字（靠右） -->
      <text
        v-for="(child, i) in children"
        :key="'t'+i"
        data-side="left"
        :x="leftMargin - 8"
        :y="childY(i)+5"
        text-anchor="end"
        font-size="16"
        fill="#64748b"
      >{{ child }}</text>
      <!-- 根節點文字（靠左） -->
      <text
        data-side="right"
        :x="leftMargin + midX + rightGap + 8"
        :y="midY+5"
        text-anchor="start"
        font-size="16"
        fill="#64748b"
      >{{ root }}</text>
    </svg>
  </div>
  `
});




