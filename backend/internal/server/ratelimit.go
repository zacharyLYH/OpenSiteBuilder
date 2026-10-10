package server

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// rateLimiter is a per-key token bucket. Memory is bounded: once the map grows
// past sweepAt, idle keys are dropped.
type rateLimiter struct {
	mu      sync.Mutex
	rate    float64 // tokens per second
	burst   float64
	clients map[string]*clientBucket
}

type clientBucket struct {
	tokens float64
	last   time.Time
}

const (
	sweepAt    = 4096
	sweepAfter = 10 * time.Minute
)

func newRateLimiter(perMinute, burst int) *rateLimiter {
	return &rateLimiter{
		rate:    float64(perMinute) / 60,
		burst:   float64(burst),
		clients: map[string]*clientBucket{},
	}
}

// allow refills the key's bucket by elapsed time and consumes one token.
func (l *rateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.clients) > sweepAt {
		for k, b := range l.clients {
			if now.Sub(b.last) > sweepAfter {
				delete(l.clients, k)
			}
		}
	}
	b, ok := l.clients[key]
	if !ok {
		b = &clientBucket{tokens: l.burst, last: now}
		l.clients[key] = b
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.rate)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// middleware applies per-client-IP limiting to next.
func (l *rateLimiter) middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(clientIP(r), time.Now()) {
			fail(w, http.StatusTooManyRequests, "too many requests")
			return
		}
		next(w, r)
	}
}

// clientIP prefers the edge-set X-Real-IP (nginx overwrites any client value),
// falling back to the socket address. The backend must not be exposed directly.
func clientIP(r *http.Request) string {
	if x := r.Header.Get("X-Real-IP"); x != "" {
		return x
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
