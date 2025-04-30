#!/usr/bin/env python3
"""
generate_dscli_balanced.py

Generate IBM DSCLI chhost map commands by splitting each LSS range into
contiguous hex blocks and distributing any “extra” volumes to the hosts
with the lowest current count, achieving a near-perfect balance overall.
"""

from typing import List, Dict

# --- USER CONFIGURATION ---

# 1) Your LSS volume ranges, in the form BASE_STARTHEX-ENDHEX
volume_ranges = [
    "PRD01ABK_sys_1800-181F",
    "PRD01ABK_sys_1900-191F"
]

# 2) Your host list
num_hosts = 16
hosts = [f"PRD01ABK_iasp_{i:02d}" for i in range(1, num_hosts + 1)]

# 3) The full DSCLI device prefix
device = "IBM.2107-78NRC91"

# 4) Output file to write commands into
output_file = "Chaska_Green_DS8A50_chhost_PRD01ABK_sys.sh"
# --- END USER CONFIGURATION ---


def hex_to_int(h: str) -> int:
    return int(h, 16)


def int_to_hex(n: int) -> str:
    return f"{n:04X}"


def split_and_balance(start_hex: str,
                      end_hex: str,
                      hosts: List[str],
                      counts: Dict[str, int]) -> Dict[str, str]:
    """
    For a given hex range [start_hex..end_hex] and current per-host counts,
    split into contiguous chunks and assign the extra volumes to the hosts
    with the lowest counts. Returns a mapping host -> hex_range string.
    """
    start = hex_to_int(start_hex)
    end = hex_to_int(end_hex)
    total = end - start + 1

    # Base slice size and how many hosts need an extra +1
    base_size, remainder = divmod(total, len(hosts))

    # Choose which hosts get the +1, by lowest current counts
    extras = sorted(hosts, key=lambda h: counts[h])[:remainder]

    # Determine each host’s slice size
    sizes = {
        h: base_size + (1 if h in extras else 0)
        for h in hosts
    }

    mapping: Dict[str, str] = {}
    cur = start
    for h in hosts:
        sz = sizes[h]
        if sz <= 0:
            mapping[h] = ""
        else:
            chunk_start = cur
            chunk_end = cur + sz - 1
            if chunk_start == chunk_end:
                mapping[h] = int_to_hex(chunk_start)
            else:
                mapping[h] = f"{int_to_hex(chunk_start)}-{int_to_hex(chunk_end)}"
            cur = chunk_end + 1
            counts[h] += sz

    return mapping


def main():
    # Track how many volumes assigned per host
    counts: Dict[str, int] = {h: 0 for h in hosts}
    commands: List[str] = []

    for entry in volume_ranges:
        # entry example: "PRD01A_iasp_5000-506A"
        base, hex_range = entry.rsplit("_", 1)
        start_hex, end_hex = hex_range.split("-")

        # Get balanced subranges for this LSS
        submap = split_and_balance(start_hex, end_hex, hosts, counts)

        # Build DSCLI commands
        for h, vrange in submap.items():
            if vrange:
                commands.append(
                    f"chhost -dev {device} "
                    f"-action map "
                    f"-volume {vrange} "
                    f"{h}"
                )

    # Write out the final script
    with open(output_file, "w") as f:
        f.write("\n".join(commands) + "\n")

    # Summary output
    print(f"Generated {len(commands)} commands → {output_file}\n")
    print("Final volume counts per host:")
    for h in hosts:
        print(f"  {h}: {counts[h]}")


if __name__ == "__main__":
    main()