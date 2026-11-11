package com.squadmap.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.error.Problems;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Writes problem+json for errors raised in the security filter chain, which run before
 * Spring MVC and therefore never reach {@code GlobalExceptionHandler}.
 */
@Component
public class ProblemResponseWriter {

    private final ObjectMapper objectMapper;

    public ProblemResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, HttpStatus status, ErrorCode code, String detail)
            throws IOException {
        ProblemDetail problem = Problems.of(status, code, detail);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
