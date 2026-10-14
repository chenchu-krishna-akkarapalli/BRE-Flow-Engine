import pytest
from unittest.mock import MagicMock, patch

from app.services.email_service import (
    EmailService,
    generate_channel_admin_credentials_html,
    generate_channel_admin_credentials_text,
)
from app.worker.tasks.notification_tasks import send_channel_admin_credentials_task


def test_generate_credentials_templates():
    """Verify HTML and text templates render correct channel and credential details."""
    channel_name = "Fintech Partner Alpha"
    username = "demo@gmail.com"
    password = "FlowBRE@2026!"
    login_url = "http://localhost:3000/auth/login"

    html = generate_channel_admin_credentials_html(
        channel_name=channel_name,
        username=username,
        password=password,
        login_url=login_url,
    )
    text = generate_channel_admin_credentials_text(
        channel_name=channel_name,
        username=username,
        password=password,
        login_url=login_url,
    )

    assert channel_name in html
    assert username in html
    assert password in html
    assert "CHANNEL_ADMIN" in html
    assert "Login URL:" not in html
    assert "Log In to Channel Portal" not in html

    assert channel_name in text
    assert username in text
    assert password in text
    assert "Login URL:" not in text


def test_email_service_simulation_when_no_provider():
    """When neither SMTP nor RESEND_API_KEY is configured, email service simulates dispatch."""
    service = EmailService(api_key="", smtp_host="")
    result = service.send_credentials_email(
        to_email="demo@gmail.com",
        channel_name="Demo Channel",
        username="demo@gmail.com",
        password="FlowBRE@2026!",
    )

    assert result["status"] == "simulated"
    assert result["to"] == "demo@gmail.com"
    assert result["channel_name"] == "Demo Channel"


def test_email_service_dispatches_to_resend():
    """When RESEND_API_KEY is set and SMTP is empty, email service posts to Resend API."""
    service = EmailService(
        api_key="re_test_dummy_key_12345",
        smtp_host="",
        from_email="FlowBRE <onboarding@resend.dev>",
        login_url="http://localhost:3000/auth/login",
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id": "resend-msg-uuid-999"}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
        result = service.send_credentials_email(
            to_email="channel.admin@example.com",
            channel_name="Example Channel",
            username="channel.admin@example.com",
            password="FlowBRE@2026!",
        )

        assert result == {"id": "resend-msg-uuid-999"}
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        assert "https://api.resend.com/emails" in call_args[0]
        assert call_kwargs["headers"]["Authorization"] == "Bearer re_test_dummy_key_12345"
        payload = call_kwargs["json"]
        assert payload["to"] == ["channel.admin@example.com"]
        assert "Example Channel" in payload["subject"]


def test_email_service_dispatches_via_smtp():
    """When SMTP is configured, email service sends via smtplib."""
    service = EmailService(
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_user="test@gmail.com",
        smtp_password="testpassword1234",
        from_email="FlowBRE <test@gmail.com>",
    )

    mock_smtp_instance = MagicMock()
    with patch("smtplib.SMTP", return_value=mock_smtp_instance):
        mock_smtp_instance.__enter__.return_value = mock_smtp_instance

        result = service.send_credentials_email(
            to_email="partner@channel.com",
            channel_name="Test Partner",
            username="partner@channel.com",
            password="FlowBRE@RandomPass1!",
        )

        assert result["status"] == "sent"
        assert result["provider"] == "smtp"
        assert result["to"] == "partner@channel.com"
        mock_smtp_instance.starttls.assert_called_once()
        mock_smtp_instance.login.assert_called_once_with("test@gmail.com", "testpassword1234")
        mock_smtp_instance.sendmail.assert_called_once()


def test_send_channel_admin_credentials_task_execution():
    """Verify Celery task executes and returns expected status."""
    with patch("app.services.email_service.EmailService.send_credentials_email") as mock_send:
        mock_send.return_value = {"status": "sent", "provider": "smtp"}

        res = send_channel_admin_credentials_task(
            to_email="admin@channel.com",
            channel_name="Super Loans Inc",
            username="admin@channel.com",
            password="FlowBRE@RandomPass1!",
        )

        assert res["status"] == "SUCCESS"
        assert res["to"] == "admin@channel.com"
        assert res["channel_name"] == "Super Loans Inc"
        mock_send.assert_called_once_with(
            to_email="admin@channel.com",
            channel_name="Super Loans Inc",
            username="admin@channel.com",
            password="FlowBRE@RandomPass1!",
        )
