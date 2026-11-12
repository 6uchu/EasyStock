"""Persist broker secrets in the OS credential vault, with non-secret profile metadata on disk."""

import json
import os
from pathlib import Path
from uuid import uuid4

import keyring

SERVICE_NAME = "EasyStock Portfolio"
DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "connections.json"


def _read_profiles() -> list[dict[str, str]]:
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("저장된 연결 정보를 읽지 못했습니다.") from exc


def list_connections() -> list[dict[str, str]]:
    profiles = _read_profiles()
    try:
        keyring_backend = keyring.get_keyring()
        if keyring_backend.priority <= 0:
            raise RuntimeError("운영체제의 보안 자격 증명 저장소를 사용할 수 없습니다.")
        saved = [
            profile for profile in profiles
            if keyring.get_password(SERVICE_NAME, f"{profile['id']}:app_key")
            and keyring.get_password(SERVICE_NAME, f"{profile['id']}:app_secret")
        ]
    except Exception as exc:
        raise RuntimeError("Windows 자격 증명 관리자에 접근할 수 없습니다.") from exc

    return saved


def get_credentials(profile_id: str) -> tuple[str, str]:
    profiles = {profile["id"]: profile for profile in _read_profiles()}
    if profile_id not in profiles:
        raise RuntimeError("저장된 증권사 연결을 찾을 수 없습니다.")
    try:
        app_key = keyring.get_password(SERVICE_NAME, f"{profile_id}:app_key")
        app_secret = keyring.get_password(SERVICE_NAME, f"{profile_id}:app_secret")
    except Exception as exc:
        raise RuntimeError("Windows 자격 증명 관리자에서 키를 읽지 못했습니다.") from exc
    if not app_key or not app_secret:
        raise RuntimeError("저장된 연결 키를 찾을 수 없습니다. 증권사를 다시 연결해 주세요.")
    return app_key, app_secret


def save_connection(broker_id: str, label: str, app_key: str, app_secret: str) -> dict[str, str]:
    try:
        backend = keyring.get_keyring()
        if backend.priority <= 0:
            raise RuntimeError("운영체제의 보안 자격 증명 저장소를 사용할 수 없습니다.")
        profile_id = str(uuid4())
        keyring.set_password(SERVICE_NAME, f"{profile_id}:app_key", app_key)
        keyring.set_password(SERVICE_NAME, f"{profile_id}:app_secret", app_secret)

        profiles = _read_profiles()
        profile = {
            "id": profile_id,
            "broker_id": broker_id,
            "broker_name": "나무증권",
            "label": label.strip() or "나무증권 계정",
        }
        profiles.append(profile)
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp_file = DATA_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp_file, DATA_FILE)
        return profile
    except Exception as exc:
        raise RuntimeError(f"연결 정보를 안전하게 저장하지 못했습니다: {exc}") from exc


def delete_connection(profile_id: str) -> None:
    profiles = _read_profiles()
    if not any(profile.get("id") == profile_id for profile in profiles):
        raise RuntimeError("삭제할 저장 연결을 찾을 수 없습니다.")
    try:
        backend = keyring.get_keyring()
        if backend.priority <= 0:
            raise RuntimeError("운영체제의 보안 자격 증명 저장소를 사용할 수 없습니다.")
        keyring.delete_password(SERVICE_NAME, f"{profile_id}:app_key")
        keyring.delete_password(SERVICE_NAME, f"{profile_id}:app_secret")
        remaining = [profile for profile in profiles if profile.get("id") != profile_id]
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp_file = DATA_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(remaining, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp_file, DATA_FILE)
    except Exception as exc:
        raise RuntimeError(f"저장된 연결을 삭제하지 못했습니다: {exc}") from exc
