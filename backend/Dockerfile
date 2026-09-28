# Multi-stage Docker build for Java 22 / Spring Boot 3 Backend
FROM eclipse-temurin:22-jdk-alpine AS builder
WORKDIR /workspace

COPY pom.xml .
COPY .mvn .mvn
COPY mvnw mvnw
COPY src src

RUN chmod +x mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:22-jre-alpine
WORKDIR /app

RUN addgroup -S squadmap && adduser -S squadmap -G squadmap
USER squadmap:squadmap

COPY --from=builder /workspace/target/*.jar app.jar

EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["java", "-jar", "app.jar"]
