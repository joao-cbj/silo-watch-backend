from fastapi import FastAPI
from controllers.analytics_controller import router as analytics_router
from dotenv import load_dotenv


load_dotenv()


app = FastAPI(title="Analytics API - OpenMeteo")
app.include_router(analytics_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "analytics-api"}