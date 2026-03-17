with open("apps/api/src/main/resources/application.yml", "r") as f:
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
        new_lines.append("    key: ${CORTEX_ENCRYPTION_KEY:your-256-bit-secret}\n")
        new_lines.append("  stripe:\n")
        new_lines.append("    api-key: ${STRIPE_API_KEY:sk_test_123}\n")
        new_lines.append("    webhook-secret: ${STRIPE_WEBHOOK_SECRET:whsec_123}\n")
    elif not skip:
        new_lines.append(line)

with open("apps/api/src/main/resources/application.yml", "w") as f:
    f.writelines(new_lines)
