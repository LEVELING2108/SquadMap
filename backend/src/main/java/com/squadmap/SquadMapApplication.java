package com.squadmap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// The default in-memory user is excluded: it would log a generated password on every start.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SquadMapApplication {

    public static void main(String[] args) {
        SpringApplication.run(SquadMapApplication.class, args);
    }
}
