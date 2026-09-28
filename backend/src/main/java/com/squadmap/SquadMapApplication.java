package com.squadmap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SquadMapApplication {

    public static void main(String[] args) {
        SpringApplication.run(SquadMapApplication.class, args);
    }
}
