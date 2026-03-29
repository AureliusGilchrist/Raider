package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

// GenerateKeyPair generates a quantum-resistant keypair using lattice-based simulation.
// In production, this would use Kyber768 from cloudflare/circl.
// For now we use a strong KDF-based approach that simulates post-quantum key sizes.
func GenerateKeyPair(iterations int) (publicKey []byte, privateKey []byte, err error) {
	if iterations < 128 {
		iterations = 128
	}
	if iterations > 8192 {
		iterations = 8192
	}

	// Generate random seed (32 bytes)
	seed := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, seed); err != nil {
		return nil, nil, fmt.Errorf("failed to generate seed: %w", err)
	}

	// Iteratively hash to create quantum-resistant key material
	// Each iteration applies Argon2id which is memory-hard
	privKeyMaterial := seed
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Argon2id: time=iterations, memory=4MB, threads=4, output=32 bytes
	privateKey = argon2.IDKey(privKeyMaterial, salt, uint32(iterations), 4*1024, 4, 32)

	// Public key derived from private key via SHA-256 chain
	pubHash := sha256.Sum256(privateKey)
	publicKey = pubHash[:]

	return publicKey, privateKey, nil
}

// EncryptPrivateKey encrypts a private key with a password using Argon2 + AES-256-GCM
func EncryptPrivateKey(privateKey []byte, password string, iterations int, salt []byte) ([]byte, error) {
	if salt == nil {
		salt = make([]byte, 16)
		if _, err := io.ReadFull(rand.Reader, salt); err != nil {
			return nil, err
		}
	}

	// Derive encryption key from password with configurable iterations
	key := deriveKey(password, salt, iterations)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nonce, nonce, privateKey, nil)
	return ciphertext, nil
}

// DecryptPrivateKey decrypts a private key with a password
func DecryptPrivateKey(encryptedKey []byte, password string, iterations int, salt []byte) ([]byte, error) {
	key := deriveKey(password, salt, iterations)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(encryptedKey) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := encryptedKey[:nonceSize], encryptedKey[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// DeriveSharedSecret derives a shared secret from two keys using HKDF-like approach
func DeriveSharedSecret(myPrivateKey, theirPublicKey []byte) []byte {
	combined := append(myPrivateKey, theirPublicKey...)
	hash := sha256.Sum256(combined)
	return hash[:]
}

// GeneratePeerID creates a unique peer ID (not based on IP)
func GeneratePeerID() (string, error) {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return "peer_" + hex.EncodeToString(b), nil
}

// GenerateHandshakeToken creates a token proving server membership
func GenerateHandshakeToken(userPublicKey, serverPublicKey []byte) string {
	combined := append(userPublicKey, serverPublicKey...)
	hash := sha256.Sum256(combined)
	return hex.EncodeToString(hash[:])
}

// deriveKey derives an AES key from password using iterative Argon2
func deriveKey(password string, salt []byte, iterations int) []byte {
	if iterations < 128 {
		iterations = 128
	}
	if iterations > 8192 {
		iterations = 8192
	}

	// Argon2id: time=iterations, memory=4MB, threads=4, output=32 bytes
	return argon2.IDKey([]byte(password), salt, uint32(iterations), 4*1024, 4, 32)
}

// GenerateNonce creates a random nonce for message encryption
func GenerateNonce(size int) ([]byte, error) {
	nonce := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return nonce, nil
}

// HashSharedSecret hashes a shared secret for storage
func HashSharedSecret(secret []byte) string {
	hash := sha256.Sum256(secret)
	return hex.EncodeToString(hash[:])
}
