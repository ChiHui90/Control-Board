from typing import Any, List

import requests
from pydantic import BaseModel, Field
from langchain.llms.base import BaseLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.callbacks.manager import CallbackManagerForLLMRun
from langchain.schema import Generation, LLMResult

from .utils import query_ollama, query_llama, query_openai

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
    base_url: str
    file_name: str

class CustomOllama(BaseLLM, BaseModel):
    model: str
    base_url: str
    api_key: str

    @property
    def _llm_type(self) -> str:
        return self.model
    
    def _call(self, prompt: str, stop = None, run_manager = None, **kwargs) -> str:
        # response = query_ollama(prompt, self.base_url, self.model, self.api_key)
        response = query_openai(prompt, self.base_url, self.model, self.api_key)
        return response

    def _generate(self, prompts: list[str], stop = None, run_manager = None, **kwargs) -> LLMResult:
        generations = []
        for prompt in prompts:
            response = self._call(prompt, stop, run_manager, **kwargs)
            generations.append([Generation(text=response)])
        return LLMResult(generations=generations)