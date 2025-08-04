# Development Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files
COPY ["CyberRiskApp.csproj", "./"]
RUN dotnet restore "CyberRiskApp.csproj"

# Copy source code
COPY . .
WORKDIR "/src"
RUN dotnet build "CyberRiskApp.csproj" -c Debug -o /app/build

FROM build AS publish
RUN dotnet publish "CyberRiskApp.csproj" -c Debug -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app

# Create directories for data and logs
RUN mkdir -p /app/wwwroot/uploads /app/logs /app/backups

# Set proper permissions
RUN chown -R app:app /app && chmod -R 755 /app

# Copy published application
COPY --from=publish /app/publish .

# Switch to non-root user
USER app

# Set environment variables
ENV ASPNETCORE_ENVIRONMENT=Development
ENV ASPNETCORE_URLS=http://+:5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "CyberRiskApp.dll"]