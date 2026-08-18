---
title: "Running Proxmox VE on one NIC and a Wi-Fi card"
date: 2026-08-02
description: "Proxmox assumes you have spare Ethernet ports. If you have one port and a Wi-Fi adapter — a laptop, a mini PC, an old desktop — here's the bridge and DHCP setup that makes VMs work anyway."
tags: [guides, proxmox, networking, homelab, linux]
type: guide
repo: https://github.com/Varun-SV/Proxmox-VE-Single-NIC-Wi-Fi-Networking-Guide
author: Varun SV
---

Proxmox VE is written on the assumption that you have network ports to spare. The default setup bridges your physical NIC and hands VMs addresses from the same subnet as everything else — clean, simple, and completely dependent on having an Ethernet interface you can dedicate to it.

Plenty of hardware doesn't fit that. A laptop. A mini PC with one port. An old desktop parked in a corner where the only Ethernet run is already carrying the household's traffic. In those cases the default bridge either steals the connection you're using or leaves your VMs with no route out at all.

This is the configuration that fixes it: **Ethernet stays as it is, Wi-Fi carries the default route, and VMs live on their own internal bridge that NATs out through the wireless interface.**

> Everything here is also in [the repo](https://github.com/Varun-SV/Proxmox-VE-Single-NIC-Wi-Fi-Networking-Guide) if you'd rather clone it.

## Before you start

You need a working Proxmox install ([installation guide](https://www.proxmox.com/en/products/proxmox-virtual-environment/get-started)) on hardware meeting the [normal requirements](https://www.proxmox.com/en/products/proxmox-virtual-environment/requirements) — this changes networking only, not the specs you need.

**Back up `/etc/network/interfaces` before touching it.** A broken interfaces file on a headless box means physically attaching a monitor, and this is exactly the kind of edit that goes wrong once.

## 1. Find your interface names

```bash
ip addr
# or, with net-tools installed:
ifconfig
```

Write down both names. They'll look like `enp2s0` for Ethernet and `wlp3s0` for Wi-Fi. **Every command below uses those two as examples and yours will differ** — predictable interface naming is derived from bus position, so a different slot means a different name.

## 2. Install what's needed

```bash
apt update && apt install -y wpasupplicant isc-dhcp-server
```

`wpasupplicant` handles WPA authentication for the Wi-Fi link. `isc-dhcp-server` hands addresses to the VMs — necessary because the internal bridge is a network unto itself, with no router on it but the Proxmox host.

## 3. Rewrite the interfaces file

```bash
nano /etc/network/interfaces
```

```text
auto lo
iface lo inet loopback

# Ethernet interface
auto enp2s0
iface enp2s0 inet static
    address <enp2s0-ip-address>/24
    gateway <enp2s0-gateway-address>

# Wi-Fi interface — carries the default route
auto wlp3s0
iface wlp3s0 inet dhcp
    wpa-ssid "WIFI-SSID"
    wpa-psk "WIFI-PASSWORD"
    post-up /sbin/ip route del default || true
    post-up /sbin/ip route add default via <wlp3s0-gateway-address> dev wlp3s0 || true

# Internal bridge for the VMs
auto vmbr1
iface vmbr1 inet static
    address 192.168.50.1/24
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    post-up /sbin/sysctl -w net.ipv4.ip_forward=1
    post-up iptables -C POSTROUTING -t nat -o wlp3s0 -j MASQUERADE || iptables -t nat -A POSTROUTING -o wlp3s0 -j MASQUERADE

source /etc/network/interfaces.d/*
```

Three things in there are worth understanding rather than pasting.

**The default-route dance.** `ip route del default` followed by `ip route add default ... dev wlp3s0` forces outbound traffic over Wi-Fi even though Ethernet also has a gateway. Without it you get two default routes and the kernel picks by metric — which is to say, unpredictably. The `|| true` matters: on a boot where no default route exists yet, `del` fails, and without the guard the whole interface would fail to come up.

**`bridge-ports none`.** This bridge is deliberately attached to no physical interface. It's a private switch that exists only inside the host, which is why VMs on it can't collide with your real network.

**The idempotent iptables line.** `iptables -C` checks whether the MASQUERADE rule already exists and only adds it if not. Without that check, every `ifreload` stacks another identical rule until your NAT table is a hundred copies deep.

`192.168.50.0/24` is arbitrary but must **not** overlap your real network. If your router already hands out `192.168.50.x`, pick something else here and in the DHCP config below.

Then:

```bash
ifreload -a
```

Give it a moment to associate with the access point.

## 4. Set up DHCP for the VMs

```bash
nano /etc/dhcp/dhcpd.conf
```

```text
subnet 192.168.50.0 netmask 255.255.255.0 {
    range 192.168.50.100 192.168.50.200;
    option routers 192.168.50.1;
    option domain-name-servers 8.8.8.8, 1.1.1.1;
}
```

The range deliberately starts at `.100`, leaving `.2`–`.99` free for VMs you want to pin to a static address.

Then tell the daemon which interface to listen on — it will not guess, and getting this wrong is the most common reason the whole setup appears dead:

```bash
nano /etc/default/isc-dhcp-server
```

```text
INTERFACESv4="vmbr1"
```

```bash
systemctl restart isc-dhcp-server
```

## 5. Configure the VM

Attach the VM to **vmbr1**, and set the network device model to **VirtIO**. A paravirtualized adapter is markedly faster than the emulated alternatives and there's no reason to use anything else on a Linux or modern Windows guest.

## When it doesn't work

**VMs get no address at all** — almost always `INTERFACESv4` in `/etc/default/isc-dhcp-server`. Check `systemctl status isc-dhcp-server`; a daemon listening on the wrong interface starts perfectly happily and serves nobody.

**Addresses but no internet** — forwarding is off:

```bash
cat /proc/sys/net/ipv4/ip_forward   # must return 1
```

If it's `0`, the `post-up sysctl` didn't run. Verify the MASQUERADE rule too:

```bash
iptables -t nat -L POSTROUTING -n -v
```

**Wi-Fi never associates** — check the SSID and passphrase for characters that break parsing. Quotes, backslashes and `#` in a PSK are a reliable way to lose an evening.

**Pings `8.8.8.8` but not `google.com`** — routing works, DNS doesn't. Check `/etc/resolv.conf` *inside the VM*. The `domain-name-servers` line only helps if the guest is actually using DHCP-provided DNS.

## What this setup is and isn't

It's a genuinely useful way to get a hypervisor running on hardware that shouldn't really support one, and it's how you turn a spare laptop into a homelab without running cable.

It is **not** as reliable as wired. Wi-Fi drops, reassociates and adds latency, and every VM's traffic funnels through one wireless link and one NAT. For a lab, learning, or services nobody else depends on, that's a fine trade. For anything you'd be annoyed to lose, run a cable.

One last time: **back up `/etc/network/interfaces` and `/etc/dhcp/dhcpd.conf` before you change them again.**
