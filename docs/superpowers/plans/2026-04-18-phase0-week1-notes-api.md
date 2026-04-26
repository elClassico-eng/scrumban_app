# Phase 0 Week 1 — Notes API (echo + in-memory) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Go HTTP API for managing notes (in-memory storage) to learn fundamentals of Go, echo routing, JSON handling, struct tags, and testing. This is Week 1 of a 4-week Go foundation pet-project that culminates in a production-like deployment.

**Architecture:** Single Go module with a small set of packages. Echo HTTP framework for routing. In-memory map as storage (replaced with Postgres in Week 2). Standard `testing` package + `testify` for assertions. No ORM, no database — focus on HTTP, JSON, Go idioms.

**Tech Stack:** Go 1.22+, echo v4, testify, uuid (for id generation).

**Pet-project location:** `~/Волгу/магистратура/go-notes-api/` (sibling to scrumban_app, separate git repo).

**Why separate repo:** Keep learning code separate from Scrumban. This project is disposable after Week 4 — its purpose is to demonstrate mastery of concepts before touching Scrumban.

---

## Background reading (before starting)

Spend ~1–2 evenings on these before coding:

- [**Tour of Go**](https://go.dev/tour/welcome/1) — sections 1–8 (syntax, flow control, structs, slices, maps, methods).
- Optional: [**Go by Example**](https://gobyexample.com/) — focused quick examples.
- Optional: first 3 chapters of **Let's Go by Alex Edwards** if you have the book.

**Don't skip these.** The plan assumes you recognize `func`, `struct`, `interface`, slice/map syntax, error handling (`if err != nil`).

---

## File structure (planned for Week 1)

```
go-notes-api/
├── go.mod                    # Go module definition
├── go.sum                    # dependency checksums (auto-managed)
├── main.go                   # entrypoint: starts HTTP server
├── internal/
│   ├── note/
│   │   ├── note.go           # Note struct + validation
│   │   ├── store.go          # NoteStore interface + InMemoryStore
│   │   └── store_test.go     # unit tests for InMemoryStore
│   └── handlers/
│       ├── notes.go          # HTTP handlers: create/list/get/update/delete
│       └── notes_test.go     # handler tests
├── .gitignore
└── README.md                 # how to run and test
```

**Responsibilities:**
- `main.go` — wiring only (create store, create handlers, register routes, start server).
- `internal/note/note.go` — domain type + validation.
- `internal/note/store.go` — storage abstraction via interface; concrete in-memory implementation.
- `internal/handlers/notes.go` — HTTP handlers; depends only on `NoteStore` interface, not the concrete impl. This sets us up to swap in Postgres next week without changing handlers.

---

## Task 1 — Initialize project and git

**Files:**
- Create: `~/Волгу/магистратура/go-notes-api/.gitignore`
- Create: `~/Волгу/магистратура/go-notes-api/README.md`
- Create: `~/Волгу/магистратура/go-notes-api/go.mod`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p "$HOME/Волгу/магистратура/go-notes-api"
cd "$HOME/Волгу/магистратура/go-notes-api"
git init
```

Expected output: `Initialized empty Git repository in .../go-notes-api/.git/`

- [ ] **Step 2: Initialize Go module**

```bash
go mod init notes-api
```

Expected output: `go: creating new go.mod: module notes-api`

This creates `go.mod`:
```
module notes-api

go 1.22
```

- [ ] **Step 3: Create .gitignore**

Create `.gitignore` with:
```
# Binaries
/notes-api
/bin/
*.exe

# Test binaries
*.test
*.out

# Go workspace
go.work
go.work.sum

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
```

- [ ] **Step 4: Create README.md**

Create `README.md` with:
```markdown
# Notes API

Learning-project: Go HTTP API for managing notes.

## Week 1: Echo + in-memory storage

### Run

    go run .

Server starts on `localhost:8080`.

### Test

    go test ./...
```

- [ ] **Step 5: First commit**

```bash
git add .gitignore README.md go.mod
git commit -m "chore: initialize go-notes-api project"
```

Expected output: summary of 3 files created.

---

## Task 2 — Install echo and create hello-world server

**Files:**
- Create: `main.go`
- Modify: `go.mod` (auto, via `go get`)
- Modify: `go.sum` (auto)

- [ ] **Step 1: Install echo**

```bash
go get github.com/labstack/echo/v4
```

Expected output: `go: added github.com/labstack/echo/v4 v4.x.x` plus transitive dependencies.

- [ ] **Step 2: Create minimal main.go**

Create `main.go`:
```go
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	e := echo.New()
	e.HideBanner = true

	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	logger.Info("starting server", "addr", ":8080")
	if err := e.Start(":8080"); err != nil && err != http.ErrServerClosed {
		logger.Error("server failed", "err", err)
		os.Exit(1)
	}
}
```

- [ ] **Step 3: Run the server**

```bash
go run .
```

Expected output (JSON log lines):
```
{"time":"...","level":"INFO","msg":"starting server","addr":":8080"}
```

- [ ] **Step 4: Verify healthz endpoint (in another terminal)**

```bash
curl -s http://localhost:8080/healthz
```

Expected output: `{"status":"ok"}`

Stop the server with `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add main.go go.mod go.sum
git commit -m "feat: add echo server with healthz endpoint"
```

---

## Task 3 — Define Note domain type

**Files:**
- Create: `internal/note/note.go`

- [ ] **Step 1: Install uuid**

```bash
go get github.com/google/uuid
```

- [ ] **Step 2: Create the Note type**

Create `internal/note/note.go`:
```go
package note

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Note is a single note record.
type Note struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateInput is the payload for creating a note.
type CreateInput struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// UpdateInput is the payload for updating a note.
// Pointers allow distinguishing "not provided" from "empty string".
type UpdateInput struct {
	Title *string `json:"title,omitempty"`
	Body  *string `json:"body,omitempty"`
}

var (
	ErrTitleRequired = errors.New("title is required")
	ErrTitleTooLong  = errors.New("title must be 200 chars or fewer")
)

// Validate checks required fields on CreateInput.
func (in CreateInput) Validate() error {
	if strings.TrimSpace(in.Title) == "" {
		return ErrTitleRequired
	}
	if len(in.Title) > 200 {
		return ErrTitleTooLong
	}
	return nil
}

// Validate checks fields on UpdateInput when they're provided.
func (in UpdateInput) Validate() error {
	if in.Title != nil {
		if strings.TrimSpace(*in.Title) == "" {
			return ErrTitleRequired
		}
		if len(*in.Title) > 200 {
			return ErrTitleTooLong
		}
	}
	return nil
}
```

- [ ] **Step 3: Verify it compiles**

```bash
go build ./...
```

Expected output: (no output = success).

- [ ] **Step 4: Commit**

```bash
git add internal/note/note.go go.mod go.sum
git commit -m "feat: add Note domain type with validation"
```

---

## Task 4 — Write failing test for InMemoryStore

**Files:**
- Create: `internal/note/store_test.go`

- [ ] **Step 1: Install testify**

```bash
go get github.com/stretchr/testify
```

- [ ] **Step 2: Create the test file**

Create `internal/note/store_test.go`:
```go
package note

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryStore_Create(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	got, err := store.Create(ctx, CreateInput{Title: "Hello", Body: "World"})

	require.NoError(t, err)
	assert.NotEqual(t, "00000000-0000-0000-0000-000000000000", got.ID.String())
	assert.Equal(t, "Hello", got.Title)
	assert.Equal(t, "World", got.Body)
	assert.False(t, got.CreatedAt.IsZero())
	assert.Equal(t, got.CreatedAt, got.UpdatedAt)
}

func TestInMemoryStore_List_Empty(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	notes, err := store.List(ctx)

	require.NoError(t, err)
	assert.Empty(t, notes)
}

func TestInMemoryStore_List_AfterCreate(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	_, err := store.Create(ctx, CreateInput{Title: "A", Body: "1"})
	require.NoError(t, err)
	_, err = store.Create(ctx, CreateInput{Title: "B", Body: "2"})
	require.NoError(t, err)

	notes, err := store.List(ctx)
	require.NoError(t, err)
	assert.Len(t, notes, 2)
}

func TestInMemoryStore_Get_NotFound(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	_, err := store.Get(ctx, uuidFromString("11111111-1111-1111-1111-111111111111"))

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestInMemoryStore_Get_Found(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	created, err := store.Create(ctx, CreateInput{Title: "X", Body: "Y"})
	require.NoError(t, err)

	got, err := store.Get(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
	assert.Equal(t, "X", got.Title)
}

func TestInMemoryStore_Update(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	created, err := store.Create(ctx, CreateInput{Title: "Old", Body: "Body"})
	require.NoError(t, err)

	newTitle := "New"
	updated, err := store.Update(ctx, created.ID, UpdateInput{Title: &newTitle})
	require.NoError(t, err)

	assert.Equal(t, "New", updated.Title)
	assert.Equal(t, "Body", updated.Body)
	assert.True(t, updated.UpdatedAt.After(created.CreatedAt) || updated.UpdatedAt.Equal(created.CreatedAt))
}

func TestInMemoryStore_Update_NotFound(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	title := "x"
	_, err := store.Update(ctx, uuidFromString("22222222-2222-2222-2222-222222222222"), UpdateInput{Title: &title})

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestInMemoryStore_Delete(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	created, err := store.Create(ctx, CreateInput{Title: "Z", Body: "Q"})
	require.NoError(t, err)

	err = store.Delete(ctx, created.ID)
	require.NoError(t, err)

	_, err = store.Get(ctx, created.ID)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestInMemoryStore_Delete_NotFound(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	err := store.Delete(ctx, uuidFromString("33333333-3333-3333-3333-333333333333"))

	assert.ErrorIs(t, err, ErrNotFound)
}

// helper for readable tests
func uuidFromString(s string) uuid.UUID {
	id, _ := uuid.Parse(s)
	return id
}
```

- [ ] **Step 3: Run tests — expect failure**

```bash
go test ./internal/note/...
```

Expected output: compilation failure with errors like:
- `undefined: NewInMemoryStore`
- `undefined: ErrNotFound`

This is the failing test — the types don't exist yet. 

- [ ] **Step 4: Commit the failing test**

```bash
git add internal/note/store_test.go go.mod go.sum
git commit -m "test: add failing tests for InMemoryStore"
```

---

## Task 5 — Implement InMemoryStore

**Files:**
- Create: `internal/note/store.go`

- [ ] **Step 1: Write the store implementation**

Create `internal/note/store.go`:
```go
package note

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ErrNotFound is returned when a note with the given id doesn't exist.
var ErrNotFound = errors.New("note not found")

// NoteStore is the storage abstraction.
// Handlers depend on this interface, not any concrete implementation —
// Week 2 will add a Postgres implementation and plug it in without touching handlers.
type NoteStore interface {
	Create(ctx context.Context, in CreateInput) (Note, error)
	List(ctx context.Context) ([]Note, error)
	Get(ctx context.Context, id uuid.UUID) (Note, error)
	Update(ctx context.Context, id uuid.UUID, in UpdateInput) (Note, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// InMemoryStore is a goroutine-safe in-memory NoteStore.
// Useful for tests and Week 1 learning; replaced by Postgres in Week 2.
type InMemoryStore struct {
	mu    sync.RWMutex
	notes map[uuid.UUID]Note
}

// NewInMemoryStore constructs an empty store.
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{notes: map[uuid.UUID]Note{}}
}

func (s *InMemoryStore) Create(ctx context.Context, in CreateInput) (Note, error) {
	if err := in.Validate(); err != nil {
		return Note{}, err
	}
	now := time.Now().UTC()
	n := Note{
		ID:        uuid.New(),
		Title:     in.Title,
		Body:      in.Body,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notes[n.ID] = n
	return n, nil
}

func (s *InMemoryStore) List(ctx context.Context) ([]Note, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Note, 0, len(s.notes))
	for _, n := range s.notes {
		out = append(out, n)
	}
	// stable order: newest first
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *InMemoryStore) Get(ctx context.Context, id uuid.UUID) (Note, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n, ok := s.notes[id]
	if !ok {
		return Note{}, ErrNotFound
	}
	return n, nil
}

func (s *InMemoryStore) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (Note, error) {
	if err := in.Validate(); err != nil {
		return Note{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.notes[id]
	if !ok {
		return Note{}, ErrNotFound
	}
	if in.Title != nil {
		n.Title = *in.Title
	}
	if in.Body != nil {
		n.Body = *in.Body
	}
	n.UpdatedAt = time.Now().UTC()
	s.notes[id] = n
	return n, nil
}

func (s *InMemoryStore) Delete(ctx context.Context, id uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.notes[id]; !ok {
		return ErrNotFound
	}
	delete(s.notes, id)
	return nil
}
```

- [ ] **Step 2: Run the tests — expect pass**

```bash
go test ./internal/note/...
```

Expected output:
```
ok  	notes-api/internal/note	0.xxxs
```

If a test fails, read the error, fix, re-run.

- [ ] **Step 3: Commit**

```bash
git add internal/note/store.go
git commit -m "feat: add InMemoryStore implementation"
```

---

## Task 6 — Write failing tests for HTTP handlers

**Files:**
- Create: `internal/handlers/notes_test.go`

- [ ] **Step 1: Create the handler tests**

Create `internal/handlers/notes_test.go`:
```go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"notes-api/internal/note"
)

func newTestHandlers(t *testing.T) (*Handlers, *echo.Echo) {
	t.Helper()
	e := echo.New()
	h := New(note.NewInMemoryStore())
	h.Register(e)
	return h, e
}

func TestCreateNote_ValidInput(t *testing.T) {
	_, e := newTestHandlers(t)

	body, _ := json.Marshal(note.CreateInput{Title: "Hello", Body: "World"})
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Hello", got.Title)
	assert.Equal(t, "World", got.Body)
	assert.NotEqual(t, uuid.Nil, got.ID)
}

func TestCreateNote_MissingTitle(t *testing.T) {
	_, e := newTestHandlers(t)

	body := []byte(`{"title":"","body":"x"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

func TestListNotes_Empty(t *testing.T) {
	_, e := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got []note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Empty(t, got)
}

func TestGetNote_NotFound(t *testing.T) {
	_, e := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/notes/11111111-1111-1111-1111-111111111111", nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestCreateThenGetNote(t *testing.T) {
	_, e := newTestHandlers(t)

	body, _ := json.Marshal(note.CreateInput{Title: "Hello", Body: "World"})
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code)
	var created note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))

	req = httptest.NewRequest(http.MethodGet, "/api/notes/"+created.ID.String(), nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, created.ID, got.ID)
}

func TestUpdateNote(t *testing.T) {
	_, e := newTestHandlers(t)

	body, _ := json.Marshal(note.CreateInput{Title: "Old", Body: "Body"})
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var created note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))

	newTitle := "New"
	ubody, _ := json.Marshal(note.UpdateInput{Title: &newTitle})
	req = httptest.NewRequest(http.MethodPut, "/api/notes/"+created.ID.String(), bytes.NewReader(ubody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "New", got.Title)
	assert.Equal(t, "Body", got.Body)
}

func TestDeleteNote(t *testing.T) {
	_, e := newTestHandlers(t)

	body, _ := json.Marshal(note.CreateInput{Title: "T", Body: "B"})
	req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	var created note.Note
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &created))

	req = httptest.NewRequest(http.MethodDelete, "/api/notes/"+created.ID.String(), nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)

	req = httptest.NewRequest(http.MethodGet, "/api/notes/"+created.ID.String(), nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}
```

- [ ] **Step 2: Run — expect failure**

```bash
go test ./internal/handlers/...
```

Expected output: compilation error (`undefined: Handlers`, `undefined: New`).

- [ ] **Step 3: Commit failing tests**

```bash
git add internal/handlers/notes_test.go
git commit -m "test: add failing HTTP handler tests"
```

---

## Task 7 — Implement HTTP handlers

**Files:**
- Create: `internal/handlers/notes.go`

- [ ] **Step 1: Write the handler code**

Create `internal/handlers/notes.go`:
```go
package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"notes-api/internal/note"
)

// Handlers groups HTTP handlers for notes.
type Handlers struct {
	store note.NoteStore
}

// New constructs Handlers with the given store.
func New(store note.NoteStore) *Handlers {
	return &Handlers{store: store}
}

// Register wires routes onto the echo instance.
func (h *Handlers) Register(e *echo.Echo) {
	g := e.Group("/api/notes")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.DELETE("/:id", h.Delete)
}

// Create handles POST /api/notes.
func (h *Handlers) Create(c echo.Context) error {
	var in note.CreateInput
	if err := c.Bind(&in); err != nil {
		return c.JSON(http.StatusBadRequest, errBody("invalid_json"))
	}
	created, err := h.store.Create(c.Request().Context(), in)
	if err != nil {
		if errors.Is(err, note.ErrTitleRequired) || errors.Is(err, note.ErrTitleTooLong) {
			return c.JSON(http.StatusUnprocessableEntity, errBody(err.Error()))
		}
		return c.JSON(http.StatusInternalServerError, errBody("internal"))
	}
	return c.JSON(http.StatusCreated, created)
}

// List handles GET /api/notes.
func (h *Handlers) List(c echo.Context) error {
	notes, err := h.store.List(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, errBody("internal"))
	}
	return c.JSON(http.StatusOK, notes)
}

// Get handles GET /api/notes/:id.
func (h *Handlers) Get(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, errBody("invalid_id"))
	}
	n, err := h.store.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, note.ErrNotFound) {
			return c.JSON(http.StatusNotFound, errBody("not_found"))
		}
		return c.JSON(http.StatusInternalServerError, errBody("internal"))
	}
	return c.JSON(http.StatusOK, n)
}

// Update handles PUT /api/notes/:id.
func (h *Handlers) Update(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, errBody("invalid_id"))
	}
	var in note.UpdateInput
	if err := c.Bind(&in); err != nil {
		return c.JSON(http.StatusBadRequest, errBody("invalid_json"))
	}
	updated, err := h.store.Update(c.Request().Context(), id, in)
	if err != nil {
		switch {
		case errors.Is(err, note.ErrNotFound):
			return c.JSON(http.StatusNotFound, errBody("not_found"))
		case errors.Is(err, note.ErrTitleRequired), errors.Is(err, note.ErrTitleTooLong):
			return c.JSON(http.StatusUnprocessableEntity, errBody(err.Error()))
		default:
			return c.JSON(http.StatusInternalServerError, errBody("internal"))
		}
	}
	return c.JSON(http.StatusOK, updated)
}

// Delete handles DELETE /api/notes/:id.
func (h *Handlers) Delete(c echo.Context) error {
	id, err := parseID(c)
	if err != nil {
		return c.JSON(http.StatusBadRequest, errBody("invalid_id"))
	}
	if err := h.store.Delete(c.Request().Context(), id); err != nil {
		if errors.Is(err, note.ErrNotFound) {
			return c.JSON(http.StatusNotFound, errBody("not_found"))
		}
		return c.JSON(http.StatusInternalServerError, errBody("internal"))
	}
	return c.NoContent(http.StatusNoContent)
}

func parseID(c echo.Context) (uuid.UUID, error) {
	return uuid.Parse(c.Param("id"))
}

func errBody(msg string) map[string]string {
	return map[string]string{"error": msg}
}
```

- [ ] **Step 2: Run handler tests — expect pass**

```bash
go test ./internal/handlers/...
```

Expected output:
```
ok  	notes-api/internal/handlers	0.xxxs
```

- [ ] **Step 3: Run all tests together**

```bash
go test ./...
```

Expected output:
```
ok  	notes-api/internal/handlers	0.xxxs
ok  	notes-api/internal/note	0.xxxs
```

- [ ] **Step 4: Commit**

```bash
git add internal/handlers/notes.go
git commit -m "feat: add HTTP handlers for notes CRUD"
```

---

## Task 8 — Wire handlers into main.go

**Files:**
- Modify: `main.go`

- [ ] **Step 1: Replace main.go with wired version**

Replace the full content of `main.go` with:
```go
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"notes-api/internal/handlers"
	"notes-api/internal/note"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Recover())

	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	store := note.NewInMemoryStore()
	h := handlers.New(store)
	h.Register(e)

	logger.Info("starting server", "addr", ":8080")
	if err := e.Start(":8080"); err != nil && err != http.ErrServerClosed {
		logger.Error("server failed", "err", err)
		os.Exit(1)
	}
}
```

- [ ] **Step 2: Run server**

```bash
go run .
```

Expected: `{"time":"...","level":"INFO","msg":"starting server","addr":":8080"}` and stays alive.

- [ ] **Step 3: Hit endpoints manually (in another terminal)**

```bash
curl -s -X POST -H 'content-type: application/json' \
    -d '{"title":"First","body":"Hello"}' \
    http://localhost:8080/api/notes
```
Expected: JSON of created note with `id`, `title`, `body`, `created_at`, `updated_at`. Save the id.

```bash
curl -s http://localhost:8080/api/notes
```
Expected: array of 1 note.

```bash
curl -s http://localhost:8080/api/notes/{id}
```
Expected: the single note.

```bash
curl -s -X PUT -H 'content-type: application/json' \
    -d '{"title":"Updated"}' \
    http://localhost:8080/api/notes/{id}
```
Expected: note with `title: "Updated"`.

```bash
curl -s -X DELETE http://localhost:8080/api/notes/{id} -o /dev/null -w '%{http_code}\n'
```
Expected: `204`.

```bash
curl -s http://localhost:8080/api/notes
```
Expected: empty array `[]`.

Stop server with `Ctrl+C`.

- [ ] **Step 4: Commit**

```bash
git add main.go
git commit -m "feat: wire handlers and in-memory store in main"
```

---

## Task 9 — Add request logging middleware

**Files:**
- Modify: `main.go`

- [ ] **Step 1: Add slog-based request logger**

In `main.go`, update the middleware setup section. Replace the existing `e.Use(middleware.Recover())` line and add above the handler wiring:

```go
	e.Use(middleware.Recover())
	e.Use(middleware.RequestIDWithConfig(middleware.RequestIDConfig{
		TargetHeader: "X-Request-ID",
	}))
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogLatency:  true,
		LogRequestID: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			logger.Info("request",
				"method", v.Method,
				"uri", v.URI,
				"status", v.Status,
				"latency", v.Latency.String(),
				"request_id", v.RequestID,
			)
			return nil
		},
	}))
```

- [ ] **Step 2: Run server and observe logs**

```bash
go run .
```

In another terminal:
```bash
curl -s http://localhost:8080/api/notes
```

Expected: a log line like
```json
{"time":"...","level":"INFO","msg":"request","method":"GET","uri":"/api/notes","status":200,"latency":"...","request_id":"..."}
```

- [ ] **Step 3: Commit**

```bash
git add main.go
git commit -m "feat: add structured request logging"
```

---

## Task 10 — Graceful shutdown

**Files:**
- Modify: `main.go`

- [ ] **Step 1: Add signal-driven shutdown**

Replace the end of `main.go` (from `logger.Info("starting server"...` onwards) with:

```go
	go func() {
		logger.Info("starting server", "addr", ":8080")
		if err := e.Start(":8080"); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	// Wait for SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		logger.Error("shutdown failed", "err", err)
		os.Exit(1)
	}
	logger.Info("server stopped")
```

Add the required imports at the top:
```go
	"context"
	"os/signal"
	"syscall"
	"time"
```

- [ ] **Step 2: Verify graceful shutdown**

```bash
go run .
```

In another terminal:
```bash
curl -s http://localhost:8080/healthz &
```

Then hit `Ctrl+C` in the server terminal. Expected logs:
```
{"...","msg":"shutting down"}
{"...","msg":"server stopped"}
```

And exit code 0.

- [ ] **Step 3: Commit**

```bash
git add main.go
git commit -m "feat: add graceful shutdown on SIGINT/SIGTERM"
```

---

## Task 11 — Polish and update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Expand README with what's done**

Replace `README.md` with:
```markdown
# Notes API

Learning-project: Go HTTP API for managing notes.

## Week 1 — Echo + In-Memory Storage

### Run

    go run .

Server starts on `localhost:8080`.

### Test

    go test ./...

### Endpoints

- `GET /healthz` — health check
- `POST /api/notes` — create note `{title, body}`
- `GET /api/notes` — list notes (newest first)
- `GET /api/notes/:id` — get single note
- `PUT /api/notes/:id` — update `{title?, body?}`
- `DELETE /api/notes/:id` — delete note

### Example

    curl -X POST -H 'content-type: application/json' \
      -d '{"title":"Hello","body":"World"}' \
      http://localhost:8080/api/notes

## Roadmap

- **Week 1 (DONE):** echo + in-memory CRUD + tests + logging + graceful shutdown
- **Week 2:** PostgreSQL via pgx + sqlc + goose migrations
- **Week 3:** cookie-based auth (register, login, sessions, middleware)
- **Week 4:** Docker, CI/CD skeleton, deploy to test VM
```

- [ ] **Step 2: Run all tests one final time**

```bash
go test ./... -v
```

Expected: all tests pass, colored PASS lines.

- [ ] **Step 3: Run `go vet` and `gofmt`**

```bash
go vet ./...
gofmt -l .
```

Expected: no output from either (no issues, no unformatted files).

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: expand README with week 1 state and roadmap"
```

- [ ] **Step 5: Tag end-of-week milestone**

```bash
git tag week-1-done
git log --oneline
```

Expected: a clean linear history of ~11 commits.

---

## Week 1 — Definition of Done

- [ ] Project runs (`go run .`) and serves on :8080.
- [ ] All tests pass (`go test ./...`).
- [ ] `go vet` clean, `gofmt` clean.
- [ ] All CRUD endpoints work via `curl` (create, list, get, update, delete).
- [ ] Graceful shutdown on `Ctrl+C`.
- [ ] Structured JSON logs visible.
- [ ] README documents what's done.
- [ ] ~11 clean commits, tagged `week-1-done`.
- [ ] You can explain what every file does and why.

If all boxes checked — you've successfully completed Week 1. Take a day off, then write the Week 2 plan request (add Postgres + sqlc + goose).

---

## Tips as you go

- **Don't skip the failing-test-first step.** TDD discipline is what makes you learn faster. You verify the test actually exercises what you think it does.
- **If a step breaks**, read the compiler / test output carefully. Go's errors are usually very precise. Search the Go stdlib docs (`go doc net/http.StatusUnprocessableEntity` etc.) or echo docs.
- **Don't try to understand everything at once.** It's fine to copy an unfamiliar pattern (like `c.Request().Context()`) and revisit it later.
- **Commit often.** The plan has commits after every task. If you want more frequent commits, go for it.
- **When stuck**, search Go by Example or Tour of Go for the concept, not random Stack Overflow.

---

## What you should be able to answer at the end

- What's the difference between `struct` and `interface` in Go?
- Why does `NoteStore` being an interface matter for Week 2?
- Why do we take `context.Context` as the first argument everywhere?
- What does `errors.Is` do differently from `==`?
- Why is `sync.RWMutex` used, not `sync.Mutex`?
- What happens on `Ctrl+C` now vs before Task 10?

If you can answer these, you're ready for Week 2.