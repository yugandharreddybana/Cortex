with open("apps/web/src/hooks/useServerSync.ts", "r") as f:
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
        new_lines.append("    useDashboardStore.setState(patch as unknown as Parameters<typeof useDashboardStore.setState>[0]);\n")
    elif not skip:
        new_lines.append(line)

with open("apps/web/src/hooks/useServerSync.ts", "w") as f:
    f.writelines(new_lines)
