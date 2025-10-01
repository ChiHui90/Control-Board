import ast
import re

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import BaseOutputParser
import requests

from .utils import get_unused_cb_dfo, get_cb_object_id, create_na
from .utils import _post, convert_rule_format, get_user_device
from .english_prompts import cb_classify_features_prompt, sensor_config_prompt, select_devices_prompt
from .model import GraphState, CustomOllama
from .exceptions import AgentError

class PythonListOutputParser(BaseOutputParser):
    def parse(self, text: str):
        try:
            return ast.literal_eval(text)
        except Exception as e:
            raise ValueError(f"Failed to parse output: {text}\nError: {e}")

def select_llm(state: GraphState):
    print("workflow: select_llm")
    if state.provider == "openai":
        state.llm = ChatOpenAI(model=state.model, api_key=state.api_key)
    elif state.provider == "ollama":
        state.llm = CustomOllama(model=state.model, base_url=state.base_url, api_key=state.api_key)
    return state

def cb_classify_features(state: GraphState):
    print("workflow: cb_classify_features")
    prompt = PromptTemplate(
        template=cb_classify_features_prompt,
        input_variables=["user_input"]
    )
    chain = prompt | state.llm | PythonListOutputParser() 
    state.categories = chain.invoke({"user_input": state.user_input})
    print("使用者輸入分類: ", state.categories)
    with open(f"./data/{state.file_name}.txt", "a", encoding="utf-8") as f:
        f.write(str(state.user_input) + "\n")
        f.write(str(state.categories) + "\n\n")
    return state

def extract_categories(state: GraphState):
    print("workflow: extract_categories")
    
    if "connect" in state.categories:
        return "connect"
    else:
        error_status = f"\n!!!!!!!{str({"user_input": state.user_input, "category": state.categories})}\n!!!!!!!"
        raise AgentError("很抱歉，無法理解您的請求。", error_status)

def project_info_fetcher(state: GraphState):
    print("workflow: project_info_fetcher")
    data = {
        "api_name": "project.get",
        "payload": {
            "p_id": state.project_name
        }
    }
    response = _post("ccm_api", data)
    if response["state"] == "error":
        raise AgentError(f"Cannot find project in IoTtalk: {state.project_name}")
    state.project_info = response
    return state

def device_selector(state: GraphState):
    print("workflow: device_selector")
    selected_df = {"input": [], "output": []}

    user_device = get_user_device(state.project_info)
    matches = re.findall(r'(\S+\s*):(\s*\S+)', state.user_input)

    if not matches:
        raise AgentError("No valid input found. Expected format: <device_name>:<device_feature>")
    
    print("matches: ", matches)
    print("user_device: ", user_device)

    for d_name, alias_name in matches:
        d_name = d_name.strip()
        alias_name = alias_name.strip()

        for device in user_device["input"]:
            if device["d_name"].lower() == d_name.lower() and device["alias_name"].lower() == alias_name.lower():
                selected_df["input"].append(device)
                break
        
        for device in user_device["output"]:
            print("device d_name: ", device["d_name"])
            print("device alias_name: ", device["alias_name"])
            print("d_name: ", d_name)
            print("alias_name: ", alias_name)
            print("--------------------")
            if device["d_name"].lower() == d_name.lower() and device["alias_name"].lower() == alias_name.lower():
                selected_df["output"].append(device)
                break
    
    print("selected_df before LLM: ", selected_df)
    state.selected_df = selected_df
    return state
    
    ''' LLM 精确匹配 d_name 和 alias_name '''
    # user_ido = str(user_device["input"]).replace("'", "\"")
    # user_odo = str(user_device["output"]).replace("'", "\"")

    # prompt = PromptTemplate(
    #     template=select_devices_prompt,
    #     input_variables=["user_ido", "user_odo", "user_input"]
    # )
    # chain = prompt | state.llm | JsonOutputParser() 
    # state.selected_df = chain.invoke({"user_ido": user_ido, "user_odo": user_odo, "user_input": state.user_input})

    # filter_input = []
    # for selected_df in state.selected_df["input"]:
    #     for ido in user_device["input"]:
    #         if selected_df["dfo_id"] == ido["dfo_id"] and selected_df["alias_name"] == ido["alias_name"]:
    #             filter_input.append(selected_df)
    # state.selected_df["input"] = filter_input

    # filter_output = []
    # for selected_df in state.selected_df["output"]:
    #     for odo in user_device["output"]:
    #         if selected_df["dfo_id"] == odo["dfo_id"] and selected_df["alias_name"] == odo["alias_name"]:
    #             filter_output.append(selected_df)
    # state.selected_df["output"] = filter_output

    # pp = prompt.invoke({"user_ido": user_ido, "user_odo": user_odo, "user_input": state.user_input})
    # with open(f"./data/{state.file_name}.txt", "a", encoding="utf-8") as f:
    #     f.write(str(pp) + "\n")
    #     f.write(str(state.selected_df) + "\n\n")
    
    # if len(state.selected_df["input"]) == 0 or len(state.selected_df["output"]) == 0:
    #     error_status = f'!!!!!!!!!!!!!\n{str({"user_ido": user_ido, "user_odo": user_odo, "user_input": state.user_input, "llm_respone": state.selected_df})}\n!!!!!!!!!!!!!!!!'
    #     raise AgentError("沒有適合的 input device 或 output device", error_status)
    return state

def cb_network(state: GraphState):
    print("workflow: cb_network")
    project_info = state.project_info
    unused_cb_dfo = get_unused_cb_dfo(project_info)

    print("selected_df: ", state.selected_df)
    cb_object_id = get_cb_object_id(project_info)

    user_inputs = [(i["do_id"], i["alias_name"]) for i in state.selected_df["input"]]
    user_outputs = [(i["do_id"], i["alias_name"]) for i in state.selected_df["output"]]

    # user device -> cb output
    joins = user_inputs + [(cb_object_id["output"], f"CBElement-O{unused_cb_dfo}")]
    response = create_na(project_info, joins)
    print("user input device 連線到 cb output: ", response)

    # cb input -> user device
    joins = user_outputs + [(cb_object_id["input"], f"CBElement-TI{unused_cb_dfo}")]
    response = create_na(project_info, joins)
    print("cb input 連線 user output device: ", response)

    return state


def cb_update_rule(state: GraphState):
    print("workflow: cb_update_rule")
    url = 'http://140.113.110.4:7789/'
    response = requests.get(url + f"/cb/get_cb_id/{state.project_name}").json()
    cb_id = response["cb_id"]

    response = requests.get(url + f"cb/refresh_cb/{cb_id}")
    print("Success: refresh cb" if response.status_code == 200 else "Fail: refresh cb")
    if response != 200:
        AgentError("Failed to refresh CB.")

    response = requests.get(url + f"cb/{cb_id}/rules")
    rules = response.json()
    rules = convert_rule_format(rules)
    
    selected_df = state.selected_df

    selected_idx = None
    for idx, old_rule in enumerate(rules):
        if old_rule["actuator_alias"] != selected_df["output"][0]["alias_name"].replace("-O", ""):
            continue
                
        input_sensors_id = sorted([x["dfo_id"] for x in selected_df["input"]])
        old_rule_sensors_id = sorted([x["sensor_index"] for x in old_rule["sensors"]])

        if input_sensors_id == old_rule_sensors_id:
            selected_idx = idx
            break

    print("selected_rule_idx: ", selected_idx)
    if selected_idx is None:
        raise AgentError("Can not find rule")
    
    rule = str(rules[selected_idx]).replace("'", "\"")

    prompt = PromptTemplate(
        template=sensor_config_prompt,
        input_variables=["user_input", "rule"]
    )

    c = prompt.invoke({"user_input": state.user_input, "rule": rule})

    chain = prompt | state.llm | JsonOutputParser() 
    new_rule = chain.invoke({"user_input": state.user_input, "rule": rule})
    with open(f"./data/{state.file_name}.txt", "a", encoding="utf-8") as f:
        f.write(str(c) + "\n")
        f.write(str(new_rule) + "\n\n")

    old_rule = rules[selected_idx]
    new_rule["actuator_alias"] = old_rule["actuator_alias"]
    new_rule["rule_id"] = old_rule["rule_id"]
    rules[selected_idx] = new_rule

    for old_sensor, new_sensor in zip(old_rule["sensors"], new_rule["sensors"]):
        new_sensor["sensor_alias"] = old_sensor["sensor_alias"]
        new_sensor["sensor_index"] = old_sensor["sensor_index"]
        new_sensor["is_show_operation"] = old_sensor["is_show_operation"]
  
    response = requests.post(url + f"cb/{cb_id}/new_rules", json=rules)
    if response.status_code != 200:
        error_status = f'\n!!!!!!!!!!!!!\n{str({"rule": rule, "user_input": state.user_input, "llm_respone": new_rule})}\n!!!!!!!!!!!!!!!!'
        raise AgentError(f'Failed to set new rule', error_status)

    print("Success: set new rules" if response.status_code == 200 else "Fail: set new rules")
    print("File name:", state.file_name)

