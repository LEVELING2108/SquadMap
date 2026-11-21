package com.squadmap.common;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The app answers with JSON and talks over STOMP; it never renders views or streams Server-Sent Events.
 * Two known Spring MVC issues are passed over in osv-scanner.toml for exactly that reason, so this test
 * fails the moment that stops being true. If you need SSE or views, first upgrade Spring past those issues
 * and remove their entries.
 */
class NoViewRenderingTest {

    private static final Path SOURCES = Path.of("src/main/java");

    private static final List<Pattern> FORBIDDEN = List.of(
            // Server-Sent Events (GHSA-j9f9-w8pj-32f8).
            Pattern.compile("\\bSseEmitter\\b"),
            Pattern.compile("\\bServerSentEvent\\b"),
            Pattern.compile("text/event-stream|TEXT_EVENT_STREAM"),
            // XSLT and any other server-rendered views (GHSA-pc63-qcmh-9cmg).
            Pattern.compile("\\bXsltView(Resolver)?\\b"),
            Pattern.compile("\\bModelAndView\\b"),
            Pattern.compile("import org\\.springframework\\.web\\.servlet\\.View;"),
            Pattern.compile("\\bViewResolver\\b"),
            Pattern.compile("\\bFragmentsRendering\\b"));

    /** A plain @Controller is fine for STOMP messages; one that answers HTTP would return view names. */
    private static final Pattern PLAIN_CONTROLLER = Pattern.compile("^@Controller\\b", Pattern.MULTILINE);
    private static final Pattern HTTP_MAPPING = Pattern.compile("@(Request|Get|Post|Put|Patch|Delete)Mapping\\b");

    @Test
    void theCodeRendersNoViewsAndStreamsNoServerSentEvents() throws IOException {
        List<String> found = new ArrayList<>();
        try (Stream<Path> files = Files.walk(SOURCES)) {
            for (Path file : files.filter(path -> path.toString().endsWith(".java")).toList()) {
                String code = Files.readString(file);
                for (Pattern forbidden : FORBIDDEN) {
                    if (forbidden.matcher(code).find()) {
                        found.add(SOURCES.relativize(file) + ": " + forbidden.pattern());
                    }
                }
                if (PLAIN_CONTROLLER.matcher(code).find() && HTTP_MAPPING.matcher(code).find()) {
                    found.add(SOURCES.relativize(file) + ": @Controller answering HTTP (use @RestController)");
                }
            }
        }
        assertThat(found).as("see osv-scanner.toml before adding SSE or views").isEmpty();
    }

    @Test
    void theCheckLooksAtTheRealSources() throws IOException {
        try (Stream<Path> files = Files.walk(SOURCES)) {
            assertThat(files.filter(path -> path.toString().endsWith("Controller.java")).count()).isGreaterThan(5);
        }
    }
}
