import asyncio
import hashlib
import secrets
import logging
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel
from app.core.security import derive_password_hash, generate_salt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAIN_TENANT_UUID = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
SUB_TENANT_UUID = "681cc219-8f42-4c7c-bc29-377a40c750b8"
DEFAULT_PASSWORD = "FlowBRE@2026!"

async def seed_data():
    async with AsyncSessionLocal() as db:
        logger.info("1. Seeding Main Tenant: Bank of India Channel...")
        main_tenant = await db.scalar(select(TenantModel).where(TenantModel.id == MAIN_TENANT_UUID))
        if not main_tenant:
            main_tenant = TenantModel(
                id=MAIN_TENANT_UUID,
                tenant_uuid=MAIN_TENANT_UUID,
                name="Bank of India Channel",
                code="boi-channel-north",
                channel_type="DSA",
                status="active",
                cibil_overlay=10,
                contact_email="super.admin@flowbre.com",
                contact_phone="+91 98765 43210",
                is_active=True,
            )
            db.add(main_tenant)
            await db.flush()

        logger.info("2. Seeding Partner Tenant: Apex FinTech Punjab...")
        sub_tenant = await db.scalar(select(TenantModel).where(TenantModel.id == SUB_TENANT_UUID))
        if not sub_tenant:
            sub_tenant = TenantModel(
                id=SUB_TENANT_UUID,
                tenant_uuid=SUB_TENANT_UUID,
                name="Apex FinTech Punjab",
                code="apex-fintech-punjab",
                channel_type="FINTECH_PARTNER",
                status="active",
                cibil_overlay=15,
                contact_email="partner@apex-punjab.in",
                contact_phone="+91 98222 11100",
                is_active=True,
            )
            db.add(sub_tenant)
            await db.flush()

        # Users list specification:
        # Bank of India Channel (Main Tenant):
        # - SUPER_ADMIN: Ratan Tata & Super Admin
        # - REGIONAL_DIRECTOR: Regional Director
        # - OPERATIONS_HEAD: Operations Head
        # - ACCOUNTS_HEAD: Accounts Head
        # - AREA_MANAGER: Area Manager
        # - TEAM_LEADER: Team Leader
        # - SALES_MANAGER: Sales Manager
        # - CHANNEL_ADMIN: Harpreet Singh (Apex FinTech's Channel Admin)
        # Apex FinTech Punjab (Sub-Tenant):
        # - CHANNEL_ADMIN: Harpreet Singh
        # - TRANSACTIONAL_USER: Simran Kaur & Gurpreet Gill
        
        users_to_create = [
            # Main Tenant Corporate Roles
            {
                "email": "ratan-tata@gmail.com",
                "full_name": "Ratan Tata",
                "role": "SUPER_ADMIN",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "super.admin@flowbre.com",
                "full_name": "Super Admin",
                "role": "SUPER_ADMIN",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "regional.director@flowbre.com",
                "full_name": "Vikram Malhotra",
                "role": "REGIONAL_DIRECTOR",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "ops.head@flowbre.com",
                "full_name": "Ananya Sharma",
                "role": "OPERATIONS_HEAD",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "accounts.head@flowbre.com",
                "full_name": "Rajesh Mehta",
                "role": "ACCOUNTS_HEAD",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "area.manager@boi.com",
                "full_name": "Suresh Raina",
                "role": "AREA_MANAGER",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "team.leader@boi.com",
                "full_name": "Amit Patel",
                "role": "TEAM_LEADER",
                "tenant_id": MAIN_TENANT_UUID,
            },
            {
                "email": "sales.manager@boi.com",
                "full_name": "Priya Singh",
                "role": "SALES_MANAGER",
                "tenant_id": MAIN_TENANT_UUID,
            },
            # Channel Admin for Apex FinTech (bound to sub_tenant)
            {
                "email": "partner@apex-punjab.in",
                "full_name": "Harpreet Singh",
                "role": "CHANNEL_ADMIN",
                "tenant_id": SUB_TENANT_UUID,
            },
            # Transactional Users for Apex FinTech (bound to sub_tenant ONLY)
            {
                "email": "simran.k@apex-punjab.in",
                "full_name": "Simran Kaur",
                "role": "TRANSACTIONAL_USER",
                "tenant_id": SUB_TENANT_UUID,
            },
            {
                "email": "gurpreet.g@apex-punjab.in",
                "full_name": "Gurpreet Gill",
                "role": "TRANSACTIONAL_USER",
                "tenant_id": SUB_TENANT_UUID,
            },
        ]

        logger.info("3. Seeding users into user_account table...")
        for u in users_to_create:
            salt = generate_salt(16)
            pwd_hash = derive_password_hash(DEFAULT_PASSWORD, salt)
            user_model = UserModel(
                username=u["email"],
                email=u["email"],
                full_name=u["full_name"],
                role=u["role"],
                tenant_id=u["tenant_id"],
                password_hash=pwd_hash,
                salt=salt,
                is_active=True,
            )
            db.add(user_model)

        await db.commit()
        logger.info("Successfully seeded clean database state!")

if __name__ == "__main__":
    asyncio.run(seed_data())
