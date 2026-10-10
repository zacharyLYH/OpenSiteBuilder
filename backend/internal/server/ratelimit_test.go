package server

import "testing"

// The API must shed load per client IP instead of hammering GitHub forever.
func TestSecurity_RateLimitShedsLoad(t *testing.T) {
	e := newTestEnv(t, mockOptions{})
	for i := 0; i < 500; i++ {
		if code, _ := e.state("my-shop"); code == 429 {
			return
		}
	}
	t.Fatal("expected a 429 once the burst was exhausted")
}
