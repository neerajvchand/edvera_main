class ToolError(Exception):
    def __init__(
        self,
        message: str,
        tool_name: str,
        recoverable: bool = True,
        error_type: str = "tool_error",
    ):
        self.tool_name = tool_name
        self.recoverable = recoverable
        self.error_type = error_type
        super().__init__(message)


class DistrictBoundaryViolation(ToolError):
    def __init__(self, tool_name: str):
        super().__init__(
            message="Access denied. Requested resource does not "
            "belong to the authenticated user's district.",
            tool_name=tool_name,
            recoverable=False,
            error_type="district_boundary_violation",
        )


class UserContextError(ToolError):
    def __init__(self, tool_name: str):
        super().__init__(
            message="User context not found. Cannot proceed "
            "without authenticated user context.",
            tool_name=tool_name,
            recoverable=False,
            error_type="user_context_error",
        )
