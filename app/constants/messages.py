# Human-Readable API & Error Messages

MSG_HEALTH_OK = "FlowBRE Engine is healthy and operational."
MSG_READY_OK = "FlowBRE Engine dependencies (Postgres DB, Redis, Zen RAM Rules) are ready."

# Exception Messages
MSG_ERR_TENANT_HEADER_REQUIRED = "Missing required X-Tenant-ID header."
MSG_ERR_TENANT_NOT_FOUND = "Tenant '{tenant_id}' not found or inactive."
MSG_ERR_RATE_LIMIT_EXCEEDED = "Tenant rate limit exceeded. Please try again later."
MSG_ERR_RULE_EVALUATION = "Error evaluating decision rules against candidate payload."
MSG_ERR_APPLICATION_NOT_FOUND = "Application '{application_id}' not found."
MSG_ERR_UNAUTHORIZED = "Invalid or expired access token."
MSG_ERR_JDM_NOT_FOUND = "Decision model rule set '{rule_name}' not found."

# Evaluation Success Messages
MSG_EVALUATION_APPROVED = "Onboarding application approved across selected policy requirements."
MSG_EVALUATION_REJECTED = "Onboarding application declined due to policy threshold rejections."
