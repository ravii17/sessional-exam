import os
import io
import uuid
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for vector stores to allow session-based context
session_stores = {}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...)):
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key is required")
        
    try:
        # 1. Read file contents and extract text
        contents = await file.read()
        pdf_reader = PdfReader(io.BytesIO(contents))
        
        text = ""
        for page in pdf_reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
                
        if not text.strip():
            raise HTTPException(status_code=400, detail="No extractable text found in the PDF")
            
        # 2. Chunk the text into meaningful overlapping segments
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_text(text)
        
        # 3. Create Embeddings using the provided API Key and store them in FAISS
        embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=api_key)
        vector_store = FAISS.from_texts(chunks, embeddings)
        
        # 4. Save to session
        session_id = str(uuid.uuid4())
        session_stores[session_id] = vector_store
        
        return {"session_id": session_id, "message": f"Successfully processed {len(chunks)} text chunks"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    session_id: str
    message: str
    api_key: str

@app.post("/chat")
async def chat_with_pdf(request: ChatRequest):
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API Key is required")
    if request.session_id not in session_stores:
        raise HTTPException(status_code=400, detail="Invalid session. Please upload your PDF again.")
        
    try:
        # Retrieve the specific vector store for this session
        vector_store = session_stores[request.session_id]
        # Retrieve chunks manually
        docs = vector_store.similarity_search(request.message, k=5)
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Instantiate the LLM API using the provided API Key
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=request.api_key, temperature=0.3)
        
        system_prompt = (
            "You are a helpful and intelligent AI assistant that answers questions based STRICTLY on the provided PDF context. "
            "Use the following pieces of context to comprehensively answer the question. "
            "If you do not know the answer based on the context, simply say that you don't know based on the provided document. "
            "Do not make up facts outside the provided document.\n\n"
            f"Context:\n{context}"
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
        
        # Manually format prompt and execute query
        messages = prompt.format_messages(input=request.message)
        response = llm.invoke(messages)
        
        return {"answer": response.content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
