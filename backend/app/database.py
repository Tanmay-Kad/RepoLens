from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGODB_URI

client = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.repolens
    print("Connected to MongoDB Atlas")

async def close_db():
    global client
    if client:
        client.close()
        print("Disconnected from MongoDB")

def get_db():
    return db