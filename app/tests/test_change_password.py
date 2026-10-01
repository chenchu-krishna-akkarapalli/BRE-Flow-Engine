from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_db, get_redis
from app.core.security import create_access_token, derive_password_hash
from app.db.models.user import UserModel
from app.main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_change_password_success_and_validation():
    salt = "testsalt12345678"
    old_password = "OldPassword@123"
    pwd_hash = derive_password_hash(old_password, salt)

    user = UserModel(
        id="usr-change-pwd-1",
        username="test.user@flowbre.com",
        email="test.user@flowbre.com",
        salt=salt,
        password_hash=pwd_hash,
        role="SUPER_ADMIN",
        is_active=True,
    )

    token = create_access_token(subject=user.id, role=user.role)

    mock_db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_res
    mock_db.commit = AsyncMock()

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # Case 1: Mismatched confirm password
        resp_mismatch = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": old_password,
                "new_password": "NewPassword@2026!",
                "confirm_password": "DifferentPassword@2026!",
            },
        )
        assert resp_mismatch.status_code == 400

        # Case 2: Weak password (no number or special char)
        resp_weak = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": old_password,
                "new_password": "weakpassword",
                "confirm_password": "weakpassword",
            },
        )
        assert resp_weak.status_code == 400

        # Case 3: Reusing old password
        resp_same = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": old_password,
                "new_password": old_password,
                "confirm_password": old_password,
            },
        )
        assert resp_same.status_code == 400

        # Case 4: Incorrect current password
        resp_wrong_curr = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "WrongPassword@999",
                "new_password": "NewValidPassword@2027!",
                "confirm_password": "NewValidPassword@2027!",
            },
        )
        assert resp_wrong_curr.status_code == 400

        # Case 5: Valid password change
        resp_success = client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": old_password,
                "new_password": "NewValidPassword@2027!",
                "confirm_password": "NewValidPassword@2027!",
            },
        )
        assert resp_success.status_code == 200
        data = resp_success.json()
        assert data["success"] is True
        assert user.password_hash != pwd_hash
        assert user.salt != salt
        mock_db.commit.assert_called()

    finally:
        app.dependency_overrides.pop(get_db, None)
