"""Pipe the vault's key to the signing process; never create a private-key file."""
import json
import os
import subprocess
import sys


def main():
    if sys.stdout.isatty() or os.environ.get("KEYMOVE_CRX_KEY_PIPE") != "1":
        raise ValueError("Use the signing command's captured pipe")
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    result = subprocess.run(
        ["pass-cli", "item", "view", "--vault-name", "minddevops", "--item-title",
         "KeyMove Chrome Web Store CRX signing", "--output", "json"],
        capture_output=True, timeout=60, check=False,
    )
    if result.returncode:
        raise ValueError("Vault read failed")
    data = json.loads(result.stdout)["item"]["content"]["content"]["SshKey"]
    key = serialization.load_ssh_private_key(data["private_key"].encode(), password=None)
    if not isinstance(key, rsa.RSAPrivateKey) or key.key_size != 4096:
        raise ValueError("Unexpected key")
    sys.stdout.buffer.write(key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never expose CLI output, parsed content or exception details containing secrets.
        sys.stderr.write("Cannot read signing key. Check Proton Pass login and Python cryptography.\n")
        sys.exit(1)
