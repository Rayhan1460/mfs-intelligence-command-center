import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select

from app.db.models import User
from app.db.session import SessionLocal
from app.repositories.artifacts import ArtifactRepository
from app.security.passwords import hash_password

ROLES = {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "AGENT", "JUDGE"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a demo or operator account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--role", required=True, choices=sorted(ROLES))
    parser.add_argument("--linked-entity-id")
    args = parser.parse_args()

    linked_type = args.role.casefold() if args.role in {"MERCHANT", "AGENT"} else None
    if linked_type and not args.linked_entity_id:
        parser.error("Merchant and agent users require --linked-entity-id.")
    if args.role not in {"MERCHANT", "AGENT"} and args.linked_entity_id:
        parser.error("--linked-entity-id is only valid for Merchant or Agent roles.")

    password = getpass("Password (minimum 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if len(password) < 12 or password != confirmation:
        parser.error("Passwords must match and be at least 12 characters.")

    email = TypeAdapter(EmailStr).validate_python(args.email).casefold()
    repository = ArtifactRepository()
    if linked_type == "merchant" and repository.by_id("merchants", "merchant_id", args.linked_entity_id) is None:
        parser.error("The linked merchant ID does not exist in the canonical merchant data.")
    if linked_type == "agent" and repository.by_id("agents", "agent_id", args.linked_entity_id) is None:
        parser.error("The linked agent ID does not exist in the canonical agent data.")

    with SessionLocal() as session:
        if session.scalar(select(User.id).where(User.email == email)):
            parser.error("A user with this email already exists.")
        user = User(
            email=email,
            password_hash=hash_password(password),
            role=args.role,
            is_active=True,
            display_name=args.display_name,
            linked_entity_type=linked_type,
            linked_entity_id=args.linked_entity_id,
        )
        session.add(user)
        session.commit()
    print(f"Created {args.role} account for {email}.")


if __name__ == "__main__":
    main()