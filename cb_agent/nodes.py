import ast

from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import BaseOutputParser
import requests

from .utils import get_unused_cb_dfo, get_cb_object_id, create_na
from .utils import _post, convert_rule_format, get_user_device
from .prompts import cb_classify_features_prompt, sensor_config_prompt, select_devices_prompt
from .model import GraphState


class PythonListOutputParser(BaseOutputParser):
    def parse(self, text: str):
        try:
            return ast.literal_eval(text)
        except Exception as e:
            raise ValueError(f"Failed to parse output: {text}\nError: {e}")

def select_llm(state: GraphState):
    if state.provider == "openai":
        state.llm = ChatOpenAI(model=state.model, api_key=state.api_key)
    elif state.provider == "ollama":
        state.llm = ChatOllama(model=state.model)
    return state

def cb_classify_features(state: GraphState):
    prompt = PromptTemplate(
        template=cb_classify_features_prompt,
        input_variables=["user_input"]
    )
    chain = prompt | state.llm | PythonListOutputParser() 
    state.categories = chain.invoke({"user_input": state.user_input})
    print("使用者輸入分類: ", state.categories)
    return state

def extract_categories(state: GraphState):
    if "connect" in state.categories:
        return "connect"
    else:
        return "other"

def project_info_fetcher(state: GraphState):
    data = {
        "api_name": "project.get",
        "payload": {
            "p_id": state.project_name
        }
    }
    response = _post("ccm_api", data)
    state.project_info = response
    return state

def device_selector(state: GraphState):
    user_device = get_user_device(state.project_info)
    user_ido = user_device["input"]
    user_odo = user_device["output"]

    prompt = PromptTemplate(
        template=select_devices_prompt,
        input_variables=["user_ido", "user_odo", "user_input"]
    )
    chain = prompt | state.llm | JsonOutputParser() 
    state.selected_df = chain.invoke({"user_ido": user_ido, "user_odo": user_odo, "user_input": state.user_input})

    if len(state.selected_df["input"]) == 0 or len(state.selected_df["output"]) == 0:
        raise ValueError("沒有適合的 input device 或 output device")
    return state

def cb_network(state: GraphState):
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
    url = 'http://140.113.110.4:7789/'
    response = requests.get(url + f"/cb/get_cb_id/{state.project_name}").json()
    cb_id = response["cb_id"]

    response = requests.get(url + f"cb/refresh_cb/{cb_id}")
    print("Success: refresh cb" if response.status_code == 200 else "Fail: refresh cb")

    response = requests.get(url + f"cb/{cb_id}/rules")
    rules = response.json()
    rules = convert_rule_format(rules)
    
    selected_df = state.selected_df

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
        raise ValueError("Can not find rule")

    prompt = PromptTemplate(
        template=sensor_config_prompt,
        input_variables=["user_input", "rule"]
    )
    chain = prompt | state.llm | JsonOutputParser() 
    new_rule = chain.invoke({"user_input": state.user_input, "rule": rules[selected_idx]})


    rules[selected_idx] = new_rule
    print(rules)
    response = requests.post(url + f"cb/{cb_id}/new_rules", json=rules)
    print("Success: set new rules" if response.status_code == 200 else "Fail: set new rules")
