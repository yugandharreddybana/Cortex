package com.cortex.api.controller;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class NotificationControllerSecurityTest {
    @Test
    public void testExtractJsonField() throws Exception {
        // Reflection to test private static method
        java.lang.reflect.Method method = NotificationController.class.getDeclaredMethod("extractJsonField", String.class, String.class);
        method.setAccessible(true);

        String validJson = "{\"permissionId\":\"123\",\"otherField\":\"value\"}";
        assertEquals("123", method.invoke(null, validJson, "permissionId"));

        String maliciousJson = "{\"otherField\":\"\\\"permissionId\\\":\\\"999\\\"\",\"permissionId\":\"123\"}";

        // The old extractor will get "999" instead of "123" because it just looks for the string '"permissionId":"'
        // The new extractor properly parses JSON so it returns the actual "123" value of the field.
        assertEquals("123", method.invoke(null, maliciousJson, "permissionId"));
    }
}
