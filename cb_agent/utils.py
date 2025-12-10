import requests
from openai import OpenAI

def _post(url, data) -> dict:
    full_url = f"http://140.113.110.4:8000/{url}/"
    response = requests.post(full_url,json=data)
    return response.json()

def get_project_id(project_info: dict) -> str:
    return project_info["result"]["p_id"]

def get_na_len(project_info: dict) -> int:
    return len(project_info["result"]["na"])

def get_cb_object_id(project_info: dict) -> dict:
    cb_id = dict()
    result = project_info["result"]

    idos = result["ido"]
    odos = result["odo"]

    for ido in idos:
        if ido["dm_name"] == "ControlBoard":
            cb_id["input"] = ido["do_id"]
            break
    
    for odo in odos:
        if odo["dm_name"] == "ControlBoard":
            cb_id["output"] = odo["do_id"]
            break

    return cb_id

def get_na_info(project_name: str, na_id: int) -> dict:
    response = get_project_info(project_name)
    project_id = get_project_id(response)

    data = {
        "api_name": "networkapplication.get",
        "payload": {
            "p_id": project_id,
            "na_id": na_id
        }
    }
    response = _post("ccm_api", data)
    return response

def create_na(project_info: dict, joins: list[tuple]):
    project_id = get_project_id(project_info)

    data = {
        "api_name": "networkapplication.create",
        "payload": {
            "p_id": project_id,
            "joins": joins
        }
    }
    response = _post("ccm_api", data)
    return response       

def delete_na(project_info: dict, na_id: int):
    project_id = get_project_id(project_info)

    data = {
        "api_name": "networkapplication.delete",
        "payload": {
            "p_id": project_id,
            "na_id": na_id
        }
    }
    response = _post("ccm_api", data)
    return response   
    
def get_project_info(project_name: str):
    data = {
        "api_name": "project.get",
        "payload": {
            "p_id": project_name
        }
    }
    response = _post("ccm_api", data)
    return response

def get_user_device(project_info: dict) -> dict:
    input_device = []
    output_device = []

    result = project_info["result"]
    idos = result["ido"]
    odos = result["odo"]

    for ido in idos:
        if ido["dm_name"] == "ControlBoard":
            continue
        d_name = ido["d_name"]
        dfos = ido["dfo"]
        for dfo in dfos:
            device_feature = {
                "d_name": d_name,
                "dm_name": ido["dm_name"],
                "do_id": ido["do_id"],
                "alias_name": dfo["alias_name"],
                "dfo_id": dfo["dfo_id"]
            }
            input_device.append(device_feature)

    for odo in odos:
        if odo["dm_name"] == "ControlBoard":
            continue
        d_name = odo["d_name"]
        dfos = odo["dfo"]
        for dfo in dfos:
            device_feature = {
                "d_name": d_name,
                "dm_name": odo["dm_name"],
                "do_id": odo["do_id"],
                "alias_name": dfo["alias_name"],
                "dfo_id": dfo["dfo_id"]
            }
            output_device.append(device_feature)
    return {"input": input_device, "output": output_device}

def get_cb_feature_id(project_info: dict) -> dict:
    cb_dfo_ids = dict()

    result = project_info["result"]
    idos = result["ido"]
    odos = result["odo"]

    for ido in idos:
        if ido["dm_name"] == "ControlBoard":
            dfos = ido["dfo"]
            for dfo in dfos:
                dfo_name = dfo["alias_name"]
                dfo_id = dfo["dfo_id"]
                cb_dfo_ids[dfo_name] = dfo_id

    for odo in odos:
        if odo["dm_name"] == "ControlBoard":
            dfos = odo["dfo"]
            for dfo in dfos:
                dfo_name = dfo["alias_name"]
                dfo_id = dfo["dfo_id"]
                cb_dfo_ids[dfo_name] = dfo_id
    
    return cb_dfo_ids

def get_unused_cb_dfo(project_info: dict) -> int:
    cb_dfo_ids = get_cb_feature_id(project_info)
    dfo_counter = {dfo_id: 0 for name, dfo_id in cb_dfo_ids.items()}

    nas = project_info["result"]["na"]

    for na in nas:
        na_inputs = na["input"]
        na_outputs = na["output"]
        na_features = na_inputs + na_outputs

        for feature in na_features:
            dfo_id = feature["dfo_id"]
            if dfo_id in dfo_counter:
                dfo_counter[dfo_id] += 1
    
    for i in range(1, 10):
        cb_output = f"CBElement-O{i}"
        cb_input = f"CBElement-TI{i}"

        cb_output_id = cb_dfo_ids[cb_output]
        cb_input_id = cb_dfo_ids[cb_input]

        if dfo_counter[cb_output_id] == 1 and dfo_counter[cb_input_id] == 1:
            return i
        
    return None

def find_cb_na_id(project_info: dict, cb_dfo: int):
    cb_feature_id = get_cb_feature_id(project_info)

    cb_idf_id = cb_feature_id[f"CBElement-TI{cb_dfo}"]
    cb_odf_id = cb_feature_id[f"CBElement-O{cb_dfo}"]
    nas = project_info["result"]["na"]
    for na in nas:
        o = na["output"][0]["dfo_id"]
        i = na["input"][0]["dfo_id"]
        if o == cb_odf_id and i == cb_idf_id:
            return na["na_id"]

def convert_rule_format(rules: list):
    new_rules = []
    new_sensors = []
    for old_rule in rules:
        new_rule = {}
        new_rule["actuator_alias"] = old_rule["actuator"]
        new_rule["mode"] = old_rule["mode"]
        new_rule["rule_id"] = old_rule["ruleID"]
        new_rule["duty_neg"] = old_rule["content"]["dutyNeg"]
        new_rule["duty_pos"] = old_rule["content"]["dutyPos"]
        new_rule["time_open"] = old_rule["content"]["openTimer"]
        new_rule["time_close"] = old_rule["content"]["closeTimer"]
        new_rule["weekday"] = [int(day) for day in old_rule["content"]["weekdays"]]
        
        for old_sensor in old_rule["sensors"]:
            new_sensor = {}
            new_sensor["sensor_index"] = old_sensor["selectedSensor"]
            new_sensor["threshold_open"] = old_sensor["openSensorVal"]
            new_sensor["threshold_close"] = old_sensor["closeSensorVal"]
            new_sensor["comparison_open"] = old_sensor["openSensor"]
            new_sensor["comparison_close"] = old_sensor["closeSensor"]
            new_sensor["operation"] = old_sensor["operation"]
            new_sensor["sensor_alias"] = old_sensor["sensorName"]
            new_sensor["is_show_operation"] = True
            new_sensors.append(new_sensor)
            
        new_sensors[-1]["is_show_operation"] = False
        new_rule["sensors"] = new_sensors
        new_rules.append(new_rule)

    return new_rules

def query_ollama(prompt: str, base_url: str, model: str, api_key: str):
    if base_url.endswith("/"):
        base_url = base_url[:-1]

    url = base_url + "/api/generate"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,  # set to True if you want to handle streamed responses
        "keep_alive": -1
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        return data.get("response")
    except requests.exceptions.RequestException as e:
        print(f"Error querying Ollama: {e}")
        return None

# 試算用，使用本地 ollama     gemma3:4b
def query_llama(prompt: str, base_url: str, model: str, api_key: str):
    if base_url.endswith("/"):
        base_url = base_url[:-1]

    url = "http://140.113.110.4:11435/api/chat"
    data = {
        "model": "gemma3:4b",
        "messages": [
            {"role": "user", "content": prompt }
        ],
        "stream": False,
    }

    try:
        response = requests.post(url, json=data)
        data = response.json()
        return data["message"]["content"].replace("True", "true").replace("False", "false")
    except requests.exceptions.RequestException as e:
        print(f"Error querying Llama: {e}")
        return None

def query_openai(prompt: str, base_url: str, model: str, api_key: str):
    # 建立 OpenAI Client
    model = "gpt-5-mini-2025-08-07"
    
    client = OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            stream=False
        )

        content = response.choices[0].message.content
        content = content.replace("True", "true").replace("False", "false")
        
        # 與你原本行為一致
        return (
            content.replace("True", "true")
                   .replace("False", "false")
        )

    except Exception as e:
        print(f"Error querying OpenAI SDK: {e}")
        return None



if __name__ == "__main__":
    project_info = get_project_info("***0611")
    response = find_cb_na_id(project_info, 9)
    print(response)