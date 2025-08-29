#!/usr/bin/env python3
"""
generate_dscli_consolidated.py

Generate IBM DSCLI chhost map commands by splitting each LSS range into
N contiguous hex blocks (one per host) and outputting a single command
per host per LSS, with volume ranges.
"""

from typing import List

# --- USER CONFIGURATION ---

# 1) Your LSS volume ranges, in the form BASE_STARTHEX-ENDHEX
PRD01A_sys_volume_ranges = [
    "PRD01A_sys_1000-1070",
    "PRD01A_sys_1100-1170",
]

PRD01A_iasp_volume_ranges = [
    "PRD01A_iasp_5000-506A",
    "PRD01A_iasp_5100-516A",
    "PRD01A_iasp_5200-52FF",
    "PRD01A_iasp_5300-53FF",
    "PRD01A_iasp_5400-54FF",
    "PRD01A_iasp_5500-55FF",
    "PRD01A_iasp_5600-56FF",
    "PRD01A_iasp_5700-57FF",
    "PRD01A_iasp_7000-702D",
    "PRD01A_iasp_7100-712D",
]

PRD01ABK_sys_volume_ranges = [
    "PRD01ABK_sys_1800-181F",
    "PRD01ABK_sys_1900-191F"
]

volume_ranges = [
    "PRD01ABK_iasp_6000-606A",
    "PRD01ABK_iasp_6100-616A",
    "PRD01ABK_iasp_6200-62FF",
    "PRD01ABK_iasp_6300-63FF",
    "PRD01ABK_iasp_6400-64FF",
    "PRD01ABK_iasp_6500-65FF",
    "PRD01ABK_iasp_6600-66FF",
    "PRD01ABK_iasp_6700-67FF",
    "PRD01ABK_iasp_9000-902D",
    "PRD01ABK_iasp_9100-912D",
]

# 2a) Either specify how many hosts you have, and let the script generate names:
num_hosts = 16
hosts = [f"PRD01ABK_iasp_{i:02d}" for i in range(1, num_hosts + 1)]

# 2b) Or explicitly list them:
# hosts = ["PRD01A_sys_01", "PRD01A_sys_02"]

# 3) The full DSCLI device prefix
device = "IBM.2107-78NRC91"

# 4) Where to write the output
output_file = "Chaska_Green_DS8A50_chhost_PRD01ABK_iasp.txt"
# --- END USER CONFIGURATION ---


def split_range(start_hex: str, end_hex: str, parts: int) -> List[str]:
    """
    Split the inclusive hex range [start_hex..end_hex] into `parts` contiguous
    sub-ranges of as-even-as-possible size. Returns strings like
    "1000-1038" or (if a single value) "1000".
    """
    start = int(start_hex, 16)
    end = int(end_hex, 16)
    total = end - start + 1
    base_size, remainder = divmod(total, parts)

    ranges = []
    cur = start
    for i in range(parts):
        size = base_size + (1 if i < remainder else 0)
        chunk_start = cur
        chunk_end = cur + size - 1
        if chunk_start == chunk_end:
            ranges.append(f"{chunk_start:04X}")
        else:
            ranges.append(f"{chunk_start:04X}-{chunk_end:04X}")
        cur = chunk_end + 1

    return ranges


def main():
    commands = []

    for entry in volume_ranges:
        # e.g. entry = "PRD01A_sys_1000-1070"
        base, hex_range = entry.rsplit("_", 1)
        start_hex, end_hex = hex_range.split("-")

        # split into N contiguous chunks, where N = len(hosts)
        subranges = split_range(start_hex, end_hex, len(hosts))

        for host, vrange in zip(hosts, subranges):
            commands.append(
                f"chhost -dev {device} "
                f"-action map "
                f"-volume {vrange} "
                f"{host}"
            )

    with open(output_file, "w") as f:
        f.write("\n".join(commands) + "\n")

    print(f"Generated {len(commands)} commands → {output_file}")


if __name__ == "__main__":
    main()