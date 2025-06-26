from pydantic import BaseModel, Field
from typing import Any, List

class GraphState(BaseModel):
    # query: str = Field(description="The original search query")
    # search_results: str = Field(default="", description="The results from the Google search")
    # response: str = Field(default="", description="The final response to the query")
    provider: str
    model: str
    llm: Any 
    api_key: str
    user_input: str
    categories: List[str]
    project_name: str
    new_rule: dict
    project_info: dict
    selected_df: dict