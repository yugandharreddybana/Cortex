with open("apps/api/src/test/resources/application.yml", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if line.startswith("<<<<<<< HEAD"):
        skip = True
    elif line.startswith("======="):
        pass
    elif line.startswith(">>>>>>> origin/main"):
        skip = False
        new_lines.extend([
            "  datasource:\n",
            "    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE\n",
            "    driver-class-name: org.h2.Driver\n",
            "    username: sa\n",
            "    password:\n",
            "  jpa:\n",
            "    database-platform: org.hibernate.dialect.H2Dialect\n",
            "    hibernate:\n",
            "      ddl-auto: create-drop\n",
            "    properties:\n",
            "      hibernate:\n",
            "        format_sql: true\n",
            "        show_sql: false\n",
            "  sql:\n",
            "    init:\n",
            "      mode: never\n",
            "\n",
            "cortex:\n",
            "  jwt:\n",
            "    secret: TEST_SECRET_TEST_SECRET_TEST_SECRET_TEST_SECRET_TEST_SECRET=\n",
            "    expiration-ms: 3600000\n",
            "    extension-expiration-ms: 3600000\n",
            "  encryption:\n",
            "    key: TEST_KEY_TEST_KEY_TEST_KEY_TEST_KEY_TEST_KEY=\n",
            "  stripe:\n",
            "    api-key: sk_test_123\n",
            "    webhook-secret: whsec_123\n",
        ])
    elif not skip:
        new_lines.append(line)

with open("apps/api/src/test/resources/application.yml", "w") as f:
    f.writelines(new_lines)
