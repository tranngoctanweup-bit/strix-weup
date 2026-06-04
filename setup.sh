#!/bin/bash
# Strix Pro - Quick Start Script

set -e

echo "🚀 Strix Pro - Quick Start"
echo "=========================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.9+"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Create virtual environment
echo "📦 Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f ~/Strix/.env ]; then
    echo "🔑 Creating .env file..."
    mkdir -p ~/Strix
    cat > ~/Strix/.env << EOF
# Strix Pro Configuration
# Add your API keys below (at least one is required)

# Google Gemini (recommended - free tier available)
GOOGLE_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Groq (free tier available)
GROQ_API_KEY=

# Mistral
MISTRAL_API_KEY=
EOF
    echo "✅ Created ~/Strix/.env"
    echo "⚠️  Please add your API keys to ~/Strix/.env"
    echo ""
fi

# Setup frontend
echo "📦 Setting up frontend..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start Strix Pro:"
echo ""
echo "  Backend (API):"
echo "    source venv/bin/activate"
echo "    python -m src.main"
echo ""
echo "  Frontend (UI):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Or use CLI mode:"
echo "    source venv/bin/activate"
echo "    python cli.py"
echo ""
echo "  Quick scan:"
echo "    python cli.py --scan example.com"
echo ""
echo "📚 Documentation: docs/"
echo ""
