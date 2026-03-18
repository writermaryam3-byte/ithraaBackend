## Ithraa Backend – Project Conventions

This document describes the agreed conventions for the Ithraa backend (NestJS + TypeORM). New code **must** follow these rules. Existing code that violates them should be updated when you touch it, or as part of a dedicated cleanup.

---

## 1. Modules, folders, and files

- **Feature folders**
  - Use **lowercase plural nouns** for REST resources: `users`, `children`, `employees`, `organizations`, `enrichers`, `tests`, `sessions`.
  - Each feature uses standard Nest structure:
    - `<feature>.module.ts`
    - `<feature>.controller.ts`
    - `<feature>.service.ts`
    - `dto/` for DTOs
    - `entities/` for TypeORM entities

- **File naming**
  - Use **kebab-case** for all file names.
  - Controllers: `<feature>.controller.ts` (e.g. `children.controller.ts`).
  - Services: `<feature>.service.ts`.
  - Modules: `<feature>.module.ts`.
  - Entities: `<name>.entity.ts` (e.g. `child-profile.entity.ts`).
  - DTOs:
    - `create-<resource>.dto.ts`
    - `update-<resource>.dto.ts`
    - `<resource>-response.dto.ts` (for response shaping DTOs)
    - Specialized auth DTOs: `login.dto.ts`, `<context>-signup.dto.ts` (e.g. `beneficiaries-signup.dto.ts`).
  - Test files: `<feature>.controller.spec.ts`, `<feature>.service.spec.ts`.

---

## 2. Classes, interfaces, and enums

- **Classes (controllers, services, modules, DTOs, entities)**
  - Use **PascalCase**.
  - Examples:
    - `UsersController`, `UsersService`, `UsersModule`
    - `CreateUserDto`, `UpdateUserDto`, `UserResponseDto`
    - `User`, `Employee`, `Child`, `Session`

- **Interfaces and types**
  - Use **PascalCase** with an optional `Dto` / `Payload` / `Options` suffix, depending on purpose.

- **Enums**
  - Enum name in **PascalCase**, members in **SCREAMING_SNAKE_CASE**.
  - Example:
    - `export enum UserRole { ADMIN = 'ADMIN', EMPLOYEE = 'EMPLOYEE', ... }`

---

## 3. Database entities and columns

- **Entity names / table names**
  - Always give `@Entity` an **explicit snake_case plural** table name:
    - `@Entity('users')`, `@Entity('employees')`, `@Entity('child_profiles')`, `@Entity('sessions')`, etc.
  - Class name is **singular PascalCase** (e.g. `User`, `Employee`, `ChildProfile`).

- **Column names**
  - Use **snake_case** for database column names.
  - Use **camelCase** for the TypeScript property name when appropriate.
  - Prefer explicit names for foreign keys:
    - `@Column({ name: 'user_id' }) userId: string;`

- **Relations**
  - Prefer modeling relations with actual entity references instead of scalar foreign key fields, unless there is a strong reason not to.
  - Relation property names should be **camelCase singular**: `user`, `organization`, `employees`, `children`, etc.

---

## 4. Routes, controllers, and DTOs

- **Route prefixes**
  - Use **lowercase plural resource names** for REST endpoints:
    - `/users`, `/children`, `/employees`, `/organizations`, `/enrichers`, `/tests`, `/sessions`.
  - Auth routes live under `/auth` with verb-like suffixes:
    - `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `<context>-signup`.

- **Standard CRUD shape**
  - `POST /resource` → `create(@Body() dto: CreateResourceDto)`.
  - `GET /resource` → `findAll(...)`.
  - `GET /resource/:id` → `findOne(@Param('id', ParseUUIDPipe) id: string)`.
  - `PATCH /resource/:id` → `update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto)`.
  - `DELETE /resource/:id` → `remove(@Param('id', ParseUUIDPipe) id: string)`.

- **DTO naming**
  - Creation DTOs: `Create<Resource>Dto`.
  - Update DTOs: `Update<Resource>Dto`.
  - Specialized DTOs: `<Action><Resource>Dto` or `<Context><Action>Dto` where it reads better.

---

## 5. IDs, types, and validation

- **ID type**
  - Primary keys are **UUID strings** (`@PrimaryGeneratedColumn('uuid') id: string;`).
  - Controller params for IDs must always be treated as **strings**, not numbers.
  - Use `ParseUUIDPipe` for any `:id` that is a uuid.

- **Never coerce ids with `+id`**
  - Do **not** convert route params to numbers using `+id` when the entity uses UUIDs.

- **Validation**
  - All request bodies must be represented as DTO classes with `class-validator` decorators.
  - Rely on the global `ValidationPipe` for whitelist/transform/forbidNonWhitelisted behavior.

---

## 6. Auth, guards, and roles

- **Guards**
  - Use `JwtAuthGuard` on any route that requires authentication.
  - Use `RolesGuard` together with the `@Roles(...)` decorator when enforcing authorization.

- **Role naming**
  - Keep enum values and usage consistent; prefer values that match the enum member names (e.g. `ADMIN`, `EMPLOYEE`, `ORGANIZATION_OWNER`).

---

## 7. Known deviations to clean up

The current codebase has a few places that do not yet follow these conventions. When you modify these areas (or as part of a cleanup task), align them with the rules above:

- `SessionController` is mounted at `/session` (singular) while other resources use plural; target is `/sessions`.
- Several controllers treat `:id` as a number via `+id` even though entities use UUID strings. These should use `ParseUUIDPipe` and string ids.
- Some entities (e.g. `Child`) omit an explicit table name in `@Entity(...)`; they should declare a snake_case plural table name to be consistent.

These guidelines are the source of truth for new code going forward.

