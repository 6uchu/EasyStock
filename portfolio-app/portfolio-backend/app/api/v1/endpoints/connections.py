from fastapi import APIRouter, HTTPException

from app.schemas.connection import ConnectionCreate, ConnectionSummary
from app.services.connection_store import delete_connection, list_connections, save_connection

router = APIRouter()


@router.get("", response_model=list[ConnectionSummary])
async def get_connections():
    try:
        return list_connections()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("", response_model=ConnectionSummary)
async def create_connection(connection: ConnectionCreate):
    try:
        return save_connection(
            connection.broker_id,
            connection.label,
            connection.app_key,
            connection.app_secret,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/{profile_id}", status_code=204)
async def remove_connection(profile_id: str):
    try:
        delete_connection(profile_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=404 if "찾을 수 없습니다" in str(exc) else 503, detail=str(exc)) from exc
