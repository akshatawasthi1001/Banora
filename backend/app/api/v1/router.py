from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.construction import router as construction_router
from app.api.v1.contractors import router as contractors_router
from app.api.v1.projects import router as projects_router
from app.api.v1.media import router as media_router
from app.api.v1.inquiries import router as inquiries_router
from app.api.v1.reviews import router as reviews_router

api_router = APIRouter(prefix="/api/v1")


@api_router.get("", tags=["system"])
def api_root() -> dict[str, str]:
    return {"message": "Banora API v1"}


api_router.include_router(auth_router)
api_router.include_router(contractors_router)
api_router.include_router(projects_router)
api_router.include_router(construction_router)
api_router.include_router(reviews_router)
api_router.include_router(media_router)
api_router.include_router(inquiries_router)