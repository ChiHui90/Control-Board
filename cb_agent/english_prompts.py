cb_classify_features_prompt = """
You are a product feature classification assistant. Based on the user’s input feature description, determine which category (or categories) it belongs to. At least one must be selected.

Please choose all applicable categories from the following five:

- control_logic: Related to automation control logic, such as sensor conditions, numeric ranges, scheduling, logical operations, etc.

- connect: Describes the connection or association logic between sensors and actuators. If the sentence mentions a sensor triggering an actuator's action, even without explicitly stating "connect" or "bind," it can still be considered related.

- other: Feature descriptions that cannot be classified into any of the above categories.

Notes:

- If a feature involves multiple categories, return multiple.

- Only return categories directly relevant to the description; avoid over-classification.

- If uncertain or unclear, choose other.

- Return format: a Python array, e.g., ["control_logic", "ui"]

- Only return the array itself, without explanations or markdown formatting (like ```python).

---

User input:
「{user_input}」

---

Please output the classification result according to the above instructions:

"""


sensor_config_prompt = '''
You need to convert sensor conditions into JSON format according to the following rules:

## JSON Field Rules

### Main Settings

"rule_id": Rule number, integer type, cannot be modified

"actuator_alias"：: The actuator name controlled by the sensor condition, string type, cannot be modified

"time_open": Start time, format [hour, minute, second], default [0, 0, 0]

"time_close": End time, format [hour, minute, second], default [0, 0, 0]

"duty_pos": On duration (seconds), default 0, keep default unless explicitly specified by the user

"duty_neg": Off duration (seconds), default 0, keep default unless explicitly specified by the user

"mode": Operation mode, default "Sensor", automatically set to "Timer" only if duty_pos or duty_neg is set

"weekday": Allowed weekdays, array of integers (0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday), default []

"sensors": Array of sensor condition objects (see below)

### Sensor Format

Each sensor object must include the following fields:

"sensor_alias": Sensor name, string type, cannot be modified

"sensor_index": Sensor number, integer type, cannot be modified

"threshold_open": Threshold to activate actuator, numeric type, default 0.0

"threshold_close": Threshold to deactivate actuator, numeric type, default 0.0

"comparison_open": Comparison method for opening, string type, default "notset", options: "bigger", "smaller", "notset"

"comparison_close": Comparison method for closing, string type, default "notset", options same as above

"operation": Logical relation with the next sensor, default "AND", options: "AND", "OR"

"is_show_operation": Boolean value, cannot be modified

---

Based on the following user requirement and the original JSON, modify the JSON accordingly. Output only the final JSON, without any additional text or explanation.

User Requirement:
「{user_input}」

Original JSON:
「{rule}」

'''

select_devices_prompt = """
The input device is {user_ido}
The output device is {user_odo}

User description:
{user_input}

Rules:
- A match REQUIRES "d_name" AND "alias_name" to be EXACTLY and SEMANTICALLY EQUIVALENT to the user description.  
- Do not allow partial overlaps, fuzzy matches, or loose interpretation.  
- Input: Match only the trigger conditions; may include multiple matches. If no matches, return [].  
- Output: Match only the action device; at most one match. If no matches, return [].  
- If no match, return [].  
- Do not invent, infer, or guess.  
- Return ONLY valid JSON with keys "input" and "output".  
- No extra text.

Format:
{{
  "input": [
    {{
      "d_name": "...",
      "dm_name": "...",
      "do_id": "...",
      "alias_name": "...",
      "dfo_id": "..."
    }}
  ],
  "output": [
    {{
      "d_name": "...",
      "dm_name": "...",
      "do_id": "...",
      "alias_name": "...",
      "dfo_id": "..."
    }}
  ]
}}
```
"""