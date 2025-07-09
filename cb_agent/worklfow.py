from langgraph.graph import StateGraph, START, END  
from langgraph.graph.state import CompiledStateGraph

from .model import GraphState
from .nodes import *

def build_workflow() -> CompiledStateGraph :
    workflow = StateGraph(GraphState)
    workflow.add_node("select_llm", select_llm)
    workflow.add_node("cb_classify_features", cb_classify_features)
    workflow.add_node("project_info_fetcher", project_info_fetcher)
    workflow.add_node("device_selector", device_selector)
    workflow.add_node("cb_network", cb_network)
    workflow.add_node("cb_update_rule", cb_update_rule)

    workflow.add_edge(START, "select_llm")
    workflow.add_edge("select_llm", "cb_classify_features")
    workflow.add_conditional_edges("cb_classify_features", extract_categories, {"connect": "project_info_fetcher", "other": END})
    workflow.add_edge("project_info_fetcher", "device_selector")
    workflow.add_edge("device_selector", "cb_network")
    workflow.add_edge("cb_network", "cb_update_rule")
    workflow.add_edge("cb_update_rule", END)
    graph = workflow.compile()
    return graph
