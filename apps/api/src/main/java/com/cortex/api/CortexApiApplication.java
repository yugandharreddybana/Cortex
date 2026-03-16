package com.cortex.api;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class CortexApiApplication {
    private static final Logger log = LoggerFactory.getLogger(CortexApiApplication.class);
    public static void main(String[] args) {
        log.info("CortexApiApplication main() starting up!");
        SpringApplication.run(CortexApiApplication.class, args);
    }

    /** One-time migration: copy legacy `name` column data into `full_name`. */
    @Bean
    CommandLineRunner migrateNameColumn(JdbcTemplate jdbc) {
        return args -> {
            try {
                jdbc.execute("UPDATE users SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL");
            } catch (Exception ignored) {
                // Column may not exist yet on first run
            }
        };
    }
}
