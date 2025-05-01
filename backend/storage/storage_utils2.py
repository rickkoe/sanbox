#!/usr/bin/env python3
from typing import List, Dict

# --- USER CONFIGURATION ---
base_name     = "PRD01A_iasp_"
volume_ranges = [
    "5000-506A",
    "5100-516A",
    "5200-52FF",
    "5300-53FF",
    "5400-54FF",
    "5500-55FF",
    "5600-56FF",
    "5700-57FF",
    "7000-702D",
    "7100-712D"
]
num_hosts    = 16
device        = "IBM.2107-78NRC91"
output_file   = "map_commands_with_base.sh"
# --- END USER CONFIGURATION ---

hosts         = [f"{base_name}{i:02d}" for i in range(1, num_hosts + 1)]

def hex_to_int(h: str) -> int:
    return int(h, 16)

def int_to_hex(n: int) -> str:
    return f"{n:04X}"

def split_and_balance(start_hex: str,
                      end_hex: str,
                      hosts: List[str],
                      counts: Dict[str, int]) -> Dict[str, str]:
    start = hex_to_int(start_hex)
    end   = hex_to_int(end_hex)
    total = end - start + 1
    base_size, remainder = divmod(total, len(hosts))
    # pick hosts for the “extra” ones
    extras = sorted(hosts, key=lambda h: counts[h])[:remainder]
    sizes = {h: base_size + (1 if h in extras else 0) for h in hosts}

    mapping: Dict[str, str] = {}
    cur = start
    for h in hosts:
        sz = sizes[h]
        if sz > 0:
            chunk_start = cur
            chunk_end   = cur + sz - 1
            if chunk_start == chunk_end:
                rng = int_to_hex(chunk_start)
            else:
                rng = f"{int_to_hex(chunk_start)}-{int_to_hex(chunk_end)}"
            mapping[h] = rng
            counts[h] += sz
            cur = chunk_end + 1
        else:
            mapping[h] = ""
    return mapping

def main():
    counts: Dict[str,int] = {h:0 for h in hosts}
    commands: List[str] = []

    for vr in volume_ranges:
        start_hex, end_hex = vr.split("-")
        submap = split_and_balance(start_hex, end_hex, hosts, counts)
        for h, rng in submap.items():
            if not rng: 
                continue
            full_vol = f"{base_name}{rng}"
            commands.append(
                f"chhost -dev {device} "
                f"-action map "
                f"-volume {full_vol} "
                f"{h}"
            )

    with open(output_file, "w") as f:
        f.write("\n".join(commands) + "\n")

    print(f"Generated {len(commands)} commands → {output_file}")
    print("Final host counts:")
    for h in hosts:
        print(f"  {h}: {counts[h]}")

if __name__ == "__main__":
    main()