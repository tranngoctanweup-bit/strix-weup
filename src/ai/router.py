"""
Strix Pro - AI Router
Supports multiple AI providers: Gemini, OpenAI, Anthropic, Groq, Mistral
"""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

class AIProvider(Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    MISTRAL = "mistral"
    CUSTOM = "custom"

@dataclass
class AIMessage:
    role: str  # "system", "user", "assistant", "tool"
    content: str
    tool_call_id: Optional[str] = None
    tool_calls: Optional[List[Dict]] = None

@dataclass
class AIResponse:
    content: str
    tool_calls: Optional[List[Dict]] = None
    provider: str = ""
    model: str = ""
    usage: Optional[Dict] = None

class AIRouter:
    """Routes AI requests to different providers"""
    
    def __init__(self):
        self.providers = {}
        self._init_providers()
    
    def _init_providers(self):
        """Initialize available AI providers based on API keys"""
        
        # Gemini
        gemini_key = os.getenv("GOOGLE_API_KEY")
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                self.providers[AIProvider.GEMINI] = {
                    "key": gemini_key,
                    "models": [
                        "gemini-2.5-flash",
                        "gemini-2.0-flash",
                        "gemini-1.5-pro",
                        "gemini-1.5-pro-exp",
                        "gemini-1.0-pro"
                    ]
                }
            except ImportError:
                pass
        
        # OpenAI
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                import openai
                self.providers[AIProvider.OPENAI] = {
                    "key": openai_key,
                    "client": openai.OpenAI(api_key=openai_key),
                    "models": ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]
                }
            except ImportError:
                pass
        
        # Anthropic
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key:
            try:
                import anthropic
                self.providers[AIProvider.ANTHROPIC] = {
                    "key": anthropic_key,
                    "client": anthropic.Anthropic(api_key=anthropic_key),
                    "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1"]
                }
            except ImportError:
                pass
        
        # Groq
        groq_key = os.getenv("GROQ_API_KEY")
        if groq_key:
            try:
                import groq
                self.providers[AIProvider.GROQ] = {
                    "key": groq_key,
                    "client": groq.Groq(api_key=groq_key),
                    "models": ["llama3-70b-8192", "llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b"]
                }
            except ImportError:
                pass
        
        # Mistral
        mistral_key = os.getenv("MISTRAL_API_KEY")
        if mistral_key:
            try:
                from mistralai import Mistral
                self.providers[AIProvider.MISTRAL] = {
                    "key": mistral_key,
                    "client": Mistral(api_key=mistral_key),
                    "models": ["mistral-large", "mistral-small-latest", "mistral-medium"]
                }
            except ImportError:
                pass
        
        # Custom OpenAI-compatible provider (e.g. Xiaomi, DeepSeek, etc.)
        custom_key = os.getenv("CUSTOM_API_KEY")
        custom_base_url = os.getenv("CUSTOM_BASE_URL")
        if custom_key and custom_base_url:
            try:
                import openai
                self.providers[AIProvider.CUSTOM] = {
                    "key": custom_key,
                    "base_url": custom_base_url,
                    "client": openai.OpenAI(api_key=custom_key, base_url=custom_base_url),
                    "models": os.getenv("CUSTOM_MODELS", "mimo-v2.5-pro").split(",")
                }
            except ImportError:
                pass
    
    def get_available_providers(self) -> Dict[str, List[str]]:
        """Get list of available providers and their models"""
        result = {}
        for provider, info in self.providers.items():
            result[provider.value] = info["models"]
        return result
    
    def chat(
        self,
        provider: str,
        model: str,
        messages: List[AIMessage],
        tools: Optional[List[Dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> AIResponse:
        """Send chat request to specified provider"""
        
        ai_provider = AIProvider(provider)
        
        if ai_provider not in self.providers:
            raise ValueError(f"Provider {provider} not available. Set {provider.upper()}_API_KEY in .env")
        
        provider_info = self.providers[ai_provider]
        
        if ai_provider == AIProvider.GEMINI:
            return self._chat_gemini(provider_info, model, messages, tools, temperature, max_tokens)
        elif ai_provider == AIProvider.OPENAI:
            return self._chat_openai(provider_info, model, messages, tools, temperature, max_tokens)
        elif ai_provider == AIProvider.ANTHROPIC:
            return self._chat_anthropic(provider_info, model, messages, tools, temperature, max_tokens)
        elif ai_provider == AIProvider.GROQ:
            return self._chat_groq(provider_info, model, messages, tools, temperature, max_tokens)
        elif ai_provider == AIProvider.MISTRAL:
            return self._chat_mistral(provider_info, model, messages, tools, temperature, max_tokens)
        elif ai_provider == AIProvider.CUSTOM:
            return self._chat_custom(provider_info, model, messages, tools, temperature, max_tokens)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def _chat_gemini(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using Google Gemini"""
        import google.generativeai as genai
        
        # Convert messages to Gemini format
        system_prompt = None
        history = []
        
        for msg in messages:
            if msg.role == "system":
                system_prompt = msg.content
            elif msg.role == "user":
                history.append({"role": "user", "parts": [msg.content]})
            elif msg.role == "assistant":
                history.append({"role": "model", "parts": [msg.content]})
        
        # Create model with tools
        gemini_tools = None
        if tools:
            gemini_tools = self._convert_tools_to_gemini(tools)
        
        model_instance = genai.GenerativeModel(
            model_name=model,
            tools=gemini_tools,
            system_instruction=system_prompt
        )
        
        chat = model_instance.start_chat(history=history[:-1] if history else [])
        response = chat.send_message(history[-1]["parts"][0] if history else "")
        
        # Extract response
        content = ""
        tool_calls = None
        
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'text') and part.text:
                content += part.text
            elif hasattr(part, 'function_call') and part.function_call:
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append({
                    "id": f"call_{len(tool_calls)}",
                    "function": {
                        "name": part.function_call.name,
                        "arguments": dict(part.function_call.args)
                    }
                })
        
        return AIResponse(
            content=content,
            tool_calls=tool_calls,
            provider="gemini",
            model=model
        )
    
    def _chat_openai(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using OpenAI"""
        client = provider_info["client"]
        
        # Convert messages to OpenAI format
        openai_messages = []
        for msg in messages:
            openai_msg = {"role": msg.role, "content": msg.content}
            if msg.tool_call_id:
                openai_msg["tool_call_id"] = msg.tool_call_id
            if msg.tool_calls:
                openai_msg["tool_calls"] = msg.tool_calls
            openai_messages.append(openai_msg)
        
        kwargs = {
            "model": model,
            "messages": openai_messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if tools:
            kwargs["tools"] = self._convert_tools_to_openai(tools)
        
        response = client.chat.completions.create(**kwargs)
        
        choice = response.choices[0]
        content = choice.message.content or ""
        tool_calls = None
        
        if choice.message.tool_calls:
            tool_calls = []
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                })
        
        return AIResponse(
            content=content,
            tool_calls=tool_calls,
            provider="openai",
            model=model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        )
    
    def _chat_custom(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using custom OpenAI-compatible provider (e.g. Xiaomi, DeepSeek)"""
        client = provider_info["client"]
        
        openai_messages = []
        for msg in messages:
            openai_msg = {"role": msg.role, "content": msg.content}
            if msg.tool_call_id:
                openai_msg["tool_call_id"] = msg.tool_call_id
            if msg.tool_calls:
                openai_msg["tool_calls"] = msg.tool_calls
            openai_messages.append(openai_msg)
        
        kwargs = {
            "model": model,
            "messages": openai_messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if tools:
            kwargs["tools"] = self._convert_tools_to_openai(tools)
        
        response = client.chat.completions.create(**kwargs)
        
        choice = response.choices[0]
        content = choice.message.content or ""
        tool_calls = None
        
        if choice.message.tool_calls:
            tool_calls = []
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                })
        
        return AIResponse(
            content=content,
            tool_calls=tool_calls,
            provider="custom",
            model=model,
            usage={
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
                "completion_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
                "total_tokens": getattr(response.usage, "total_tokens", 0) if response.usage else 0
            }
        )
    
    def _chat_anthropic(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using Anthropic Claude"""
        client = provider_info["client"]
        
        # Convert messages to Anthropic format
        system_prompt = None
        anthropic_messages = []
        
        for msg in messages:
            if msg.role == "system":
                system_prompt = msg.content
            else:
                anthropic_messages.append({"role": msg.role, "content": msg.content})
        
        kwargs = {
            "model": model,
            "messages": anthropic_messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        if system_prompt:
            kwargs["system"] = system_prompt
        
        if tools:
            kwargs["tools"] = self._convert_tools_to_anthropic(tools)
        
        response = client.messages.create(**kwargs)
        
        content = ""
        tool_calls = None
        
        for block in response.content:
            if block.type == "text":
                content += block.text
            elif block.type == "tool_use":
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append({
                    "id": block.id,
                    "function": {
                        "name": block.name,
                        "arguments": block.input
                    }
                })
        
        return AIResponse(
            content=content,
            tool_calls=tool_calls,
            provider="anthropic",
            model=model,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            }
        )
    
    def _chat_groq(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using Groq"""
        client = provider_info["client"]
        
        # Convert messages to OpenAI-compatible format
        groq_messages = []
        for msg in messages:
            groq_messages.append({"role": msg.role, "content": msg.content})
        
        response = client.chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return AIResponse(
            content=response.choices[0].message.content or "",
            provider="groq",
            model=model
        )
    
    def _chat_mistral(self, provider_info, model, messages, tools, temperature, max_tokens):
        """Chat using Mistral"""
        client = provider_info["client"]
        
        # Convert messages to Mistral format
        mistral_messages = []
        for msg in messages:
            mistral_messages.append({"role": msg.role, "content": msg.content})
        
        response = client.chat.complete(
            model=model,
            messages=mistral_messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return AIResponse(
            content=response.choices[0].message.content or "",
            provider="mistral",
            model=model
        )
    
    def _convert_tools_to_gemini(self, tools):
        """Convert generic tool format to Gemini format"""
        import google.generativeai as genai
        
        function_declarations = []
        for tool in tools:
            func = tool["function"]
            params = genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    k: genai.protos.Schema(type=genai.protos.Type.STRING, description=v.get("description", ""))
                    for k, v in func.get("parameters", {}).get("properties", {}).items()
                },
                required=func.get("parameters", {}).get("required", [])
            )
            function_declarations.append(
                genai.protos.FunctionDeclaration(
                    name=func["name"],
                    description=func["description"],
                    parameters=params
                )
            )
        
        return genai.protos.Tool(function_declarations=function_declarations)
    
    def _convert_tools_to_openai(self, tools):
        """Convert generic tool format to OpenAI format"""
        return [{
            "type": "function",
            "function": {
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "parameters": tool["function"]["parameters"]
            }
        } for tool in tools]
    
    def _convert_tools_to_anthropic(self, tools):
        """Convert generic tool format to Anthropic format"""
        return [{
            "name": tool["function"]["name"],
            "description": tool["function"]["description"],
            "input_schema": tool["function"]["parameters"]
        } for tool in tools]
