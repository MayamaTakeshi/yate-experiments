#!/usr/bin/env python3
import math
import struct
import argparse
from scapy.all import Ether, IP, UDP, wrpcap

# -------- G.711 μ-law and A-law encoders --------
def linear2ulaw(sample):
    BIAS = 0x84
    CLIP = 32635
    if sample > CLIP: sample = CLIP
    elif sample < -CLIP: sample = -CLIP
    sign = (sample >> 8) & 0x80
    if sign != 0:
        sample = -sample
    sample += BIAS
    exponent = 7
    expMask = 0x4000
    while (sample & expMask) == 0 and exponent > 0:
        exponent -= 1
        expMask >>= 1
    mantissa = (sample >> (exponent + 3)) & 0x0f
    ulawbyte = ~(sign | (exponent << 4) | mantissa)
    return ulawbyte & 0xFF

def linear2alaw(sample):
    ALAW_MAX = 0x7FFF
    mask = 0xD5
    sign = 0
    if sample < 0:
        sample = -sample
        sign = 0x80
    if sample > ALAW_MAX:
        sample = ALAW_MAX
    if sample >= 256:
        exponent = int(math.log(sample / 256.0, 2)) + 1
        mantissa = (sample >> (exponent + 3)) & 0x0f
        alaw = (exponent << 4) | mantissa
    else:
        alaw = sample >> 4
    alaw ^= (sign ^ mask)
    return alaw & 0xFF

def encode(samples, codec):
    if codec == "pcmu":
        return bytes([linear2ulaw(s) for s in samples])
    elif codec == "pcma":
        return bytes([linear2alaw(s) for s in samples])
    else:
        raise ValueError("Unknown codec")

# -------- Sine wave generator --------
def generate_sine(duration, freq, sample_rate, amplitude=10000):
    total_samples = int(duration * sample_rate)
    for n in range(total_samples):
        yield int(amplitude * math.sin(2 * math.pi * freq * n / sample_rate))

# -------- RTP packet builder --------
def build_rtp_packets(args):
    seq = args.seq_start
    timestamp = args.ts_start
    samples = list(generate_sine(args.duration, args.freq, args.sample_rate))

    packets = []
    for i in range(0, len(samples), args.samples_per_pkt):
        frame = samples[i:i+args.samples_per_pkt]
        payload = encode(frame, args.codec)

        rtp_header = struct.pack("!BBHII",
            0x80,                        # V=2, P=0, X=0, CC=0
            args.payload_type & 0x7F,    # M=0, PT
            seq,
            timestamp,
            args.ssrc
        )
        udp = UDP(sport=args.src_port, dport=args.dst_port)
        ip = IP(src=args.src_ip, dst=args.dst_ip)
        eth = Ether()
        pkt = eth / ip / udp / (rtp_header + payload)
        packets.append(pkt)

        seq += 1
        timestamp += args.samples_per_pkt

    return packets

# -------- Main --------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate RTP PCMU/PCMA sine wave pcap")
    parser.add_argument("--codec", choices=["pcmu", "pcma"], default="pcmu", help="Codec (pcmu=G.711u, pcma=G.711a)")
    parser.add_argument("--duration", type=int, default=10, help="Duration in seconds")
    parser.add_argument("--freq", type=int, default=440, help="Sine frequency in Hz")
    parser.add_argument("--sample-rate", type=int, default=8000, help="Sample rate (Hz)")
    parser.add_argument("--packet-time", type=float, default=0.02, help="Packetization time (s)")
    parser.add_argument("--src-ip", default="192.168.0.1")
    parser.add_argument("--dst-ip", default="192.168.0.2")
    parser.add_argument("--src-port", type=int, default=5000)
    parser.add_argument("--dst-port", type=int, default=4000)
    parser.add_argument("--seq-start", type=int, default=1000)
    parser.add_argument("--ts-start", type=int, default=0)
    parser.add_argument("--ssrc", type=lambda x: int(x,0), default=0x12345678)
    parser.add_argument("--outfile", default="rtp.pcap")

    args = parser.parse_args()
    args.samples_per_pkt = int(args.sample_rate * args.packet_time)
    args.payload_type = 0 if args.codec == "pcmu" else 8

    pkts = build_rtp_packets(args)
    wrpcap(args.outfile, pkts)
    print(f"✅ Generated {args.outfile} with {len(pkts)} RTP packets ({args.duration}s {args.codec.upper()}, {args.freq}Hz sine)")

