import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def generate_channel_admin_credentials_html(
    channel_name: str,
    username: str,
    password: str,
    login_url: str,
) -> str:
    """Generates a responsive, branded HTML email template for Channel Admin credentials."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to FlowBRE</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      margin: 0;
      padding: 0;
      color: #1e293b;
    }}
    .container {{
      max-width: 600px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }}
    .header {{
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      padding: 32px 28px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .welcome-badge {{
      display: inline-block;
      background-color: #dbeafe;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .greeting {{
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #0f172a;
    }}
    .intro {{
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }}
    .credentials-box {{
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 28px;
    }}
    .cred-row {{
      display: flex;
      margin-bottom: 12px;
      font-size: 14px;
    }}
    .cred-row:last-child {{
      margin-bottom: 0;
    }}
    .cred-label {{
      font-weight: 600;
      color: #64748b;
      width: 110px;
      flex-shrink: 0;
    }}
    .cred-value {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #0f172a;
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
    }}
    .button-container {{
      text-align: center;
      margin-bottom: 28px;
    }}
    .login-button {{
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }}
    .security-note {{
      border-left: 4px solid #f59e0b;
      background-color: #fffbeb;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
      margin-bottom: 24px;
    }}
    .footer {{
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FlowBRE Business Rules Engine</h1>
      <p>Channel Partner Portal Provisioning</p>
    </div>
    <div class="content">
      <span class="welcome-badge">Channel Approved</span>
      <div class="greeting">Welcome, {channel_name}!</div>
      <p class="intro">
        Your channel partner application has been approved by the Super Admin. Your Channel Administrator account has been provisioned with full operational access.
      </p>

      <div class="credentials-box">
        <div class="cred-row">
          <span class="cred-label">Username / Email:</span>
          <span class="cred-value">{username}</span>
        </div>
        <div class="cred-row" style="margin-top: 8px;">
          <span class="cred-label">Password:</span>
          <span class="cred-value">{password}</span>
        </div>
        <div class="cred-row" style="margin-top: 8px;">
          <span class="cred-label">Assigned Role:</span>
          <span style="font-weight: 600; color: #0f172a;">CHANNEL_ADMIN</span>
        </div>
      </div>

      <div class="security-note">
        <strong>Security Recommendation:</strong> This is a temporary setup password. We strongly recommend changing your password upon your initial login.
      </div>
    </div>
    <div class="footer">
      This is an automated notification from FlowBRE Engine. Please do not reply to this email directly.
    </div>
  </div>
</body>
</html>
"""


def generate_channel_admin_credentials_text(
    channel_name: str,
    username: str,
    password: str,
    login_url: str = "",
) -> str:
    """Generates plain text fallback for Channel Admin credentials email."""
    return f"""Welcome to FlowBRE!

Your channel partner application for '{channel_name}' has been approved by the Super Admin.

Your Channel Administrator login credentials:
- Username / Email: {username}
- Password: {password}
- Role: CHANNEL_ADMIN

Security Notice: We recommend updating your password upon your initial login.

--
FlowBRE Engine Onboarding Team
"""


class EmailService:
    """Service handling transactional emails via SMTP (e.g. Gmail) or Resend API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        from_email: Optional[str] = None,
        login_url: Optional[str] = None,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        smtp_use_tls: Optional[bool] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.RESEND_API_KEY
        self.from_email = from_email or settings.EMAIL_FROM
        self.login_url = login_url or settings.FRONTEND_LOGIN_URL
        self.smtp_host = smtp_host if smtp_host is not None else settings.SMTP_HOST
        self.smtp_port = smtp_port if smtp_port is not None else settings.SMTP_PORT
        self.smtp_user = smtp_user if smtp_user is not None else settings.SMTP_USER
        self.smtp_password = smtp_password if smtp_password is not None else settings.SMTP_PASSWORD
        self.smtp_use_tls = smtp_use_tls if smtp_use_tls is not None else settings.SMTP_USE_TLS

    def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Dict[str, Any]:
        """Delivers email via standard SMTP (e.g. Gmail SMTP)."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to_email

        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=20.0) as server:
            if self.smtp_use_tls:
                server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.from_email, [to_email], msg.as_string())

        logger.info("Successfully dispatched credentials email to %s via SMTP (%s)", to_email, self.smtp_host)
        return {
            "status": "sent",
            "provider": "smtp",
            "to": to_email,
            "host": self.smtp_host,
        }

    def _send_via_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Dict[str, Any]:
        """Delivers email via Resend REST API."""
        payload = {
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=15.0) as client:
            response = client.post(RESEND_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info("Successfully dispatched credentials email to %s (Resend ID: %s)", to_email, data.get("id"))
            return data

    def send_credentials_email(
        self,
        to_email: str,
        channel_name: str,
        username: str,
        password: str,
    ) -> Dict[str, Any]:
        """Synchronously sends credentials email via SMTP or Resend (used by Celery workers)."""
        html_content = generate_channel_admin_credentials_html(
            channel_name=channel_name,
            username=username,
            password=password,
            login_url=self.login_url,
        )
        text_content = generate_channel_admin_credentials_text(
            channel_name=channel_name,
            username=username,
            password=password,
            login_url=self.login_url,
        )

        subject = f"Welcome to FlowBRE - Credentials for {channel_name}"

        # 1. Prefer SMTP if configured (e.g. Gmail SMTP)
        if self.smtp_host and self.smtp_user and self.smtp_password:
            return self._send_via_smtp(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )

        # 2. Fall back to Resend API if configured
        if self.api_key:
            return self._send_via_resend(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )

        # 3. Simulate cleanly if neither is configured
        logger.warning(
            "Neither SMTP nor RESEND_API_KEY is configured. Simulated credentials email to '%s' for channel '%s'.",
            to_email,
            channel_name,
        )
        return {
            "status": "simulated",
            "to": to_email,
            "channel_name": channel_name,
            "message": "Email sending simulated (No email provider configured)",
        }
