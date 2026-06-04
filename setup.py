"""Setup script for Strix Pro"""

from setuptools import setup, find_packages

setup(
    name="strix-pro",
    version="1.0.0",
    description="AI-Powered Security Platform",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Strix Pro Team",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "fastapi>=0.109.0",
        "uvicorn[standard]>=0.27.0",
        "websockets>=12.0",
        "pydantic>=2.5.3",
        "python-dotenv>=1.0.0",
        "sqlalchemy>=2.0.25",
        "aiosqlite>=0.19.0",
        "openai>=1.12.0",
        "anthropic>=0.18.0",
        "google-generativeai>=0.3.2",
        "groq>=0.4.2",
        "mistralai>=1.0.0",
        "requests>=2.31.0",
        "beautifulsoup4>=4.12.3",
        "cryptography>=42.0.2",
        "colorama>=0.4.6",
        "rich>=13.7.0",
        "jinja2>=3.1.3",
        "httpx>=0.26.0",
        "apscheduler>=3.10.4",
    ],
    extras_require={
        "github": ["PyGithub>=2.1.1"],
        "reports": ["weasyprint>=61.0"],
        "dev": ["pytest", "black", "flake8", "mypy"],
    },
    entry_points={
        "console_scripts": [
            "strix-pro=cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Information Technology",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Security",
    ],
)
