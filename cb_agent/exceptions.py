class AgentError(Exception):
    def __init__(self, message, error_status=""):
        self.error_status = error_status
        super().__init__(message)

