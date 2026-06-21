# Project Domain Reference

## Actors

### System Admin

Responsible for:

* Activating organizations
* Activating service providers
* Managing activities
* Managing assessments
* Managing system-wide analytics
* Handling payment approvals
* Sending payment links
* Reviewing audit logs

---

### Organization Owner

Responsible for:

* Managing organization
* Managing teachers
* Managing stages
* Managing classes
* Managing institution children
* Viewing institution reports
* Creating deals

---

### Teacher

Responsible for:

* Managing institution children
* Viewing evaluations
* Sending reminders
* Performing evaluations when parent did not

---

### Parent

A Parent is a business entity represented by:

ParentProfile

A Parent may:

* Register independently
* Be auto-created by an organization
* Have private children
* Have organization children
* Be linked to multiple organizations

A Parent is NOT merely a Role.

---

### Child

There are TWO completely separate child types.

#### Organization Child

* Belongs to an organization
* Belongs to a stage
* Belongs to a class
* Linked to a parent
* Results visible to organization

#### Private Child

* Belongs only to parent
* Not linked to any organization
* Results remain private

A child can never be both types simultaneously.

---

### Service Provider (Enricher)

Lifecycle:

Registration
→ Admin Approval
→ Contract Signing
→ Active Access

Responsible for:

* Viewing deals
* Sending proposals
* Recording attendance
* Participating in evaluations

---

# Parent Lifecycle

## Independent Parent

Register
→ Account Active
→ Create Parent Profile
→ Add Child (max 2)
→ Run Assessments
→ View Reports

If child limit reached:

Request Additional Capacity
→ Admin Review
→ Payment Link Sent
→ Payment Success
→ Additional Children Allowed

---

## Organization Parent

Teacher/Owner searches by phone

IF Parent Exists:

Check Child

IF Child Exists:
Transfer Request

ELSE:
Create Child

IF Parent Doesn't Exist:

Create User
Create Parent Profile
Create Child

---

# Organization Lifecycle

Guest
→ Register Organization
→ Pending Approval
→ Admin Approval
→ Active

Organization can then:

* Create Stages
* Create Classes
* Create Teachers
* Create Children
* Create Deals

---

# Deal Lifecycle

Organization creates deal

Select Activity
→ Define student count
→ Publish Deal

System notifies providers

Providers submit proposals

Organization reviews proposals

Organization selects proposal

Admin approves/rejects selected proposal

If approved:

Deal Awarded
→ Activity Execution
→ Attendance
→ Evaluation
→ Closure

---

# Assessment Domain

Assessment is NOT generic.

Each Assessment has:

* Different Questions
* Different Answers
* Different Scoring Logic
* Different Result Categories
* Different Interpretation Rules
* Different Report Template

Examples:

Assessment A
Questions A
Formula A
Report A

Assessment B
Questions B
Formula B
Report B

Assessment C
Questions C
Formula C
Report C

Therefore:

Assessment Engine must support:

* Dynamic Questions
* Dynamic Answer Types
* Dynamic Scoring Strategies
* Dynamic Result Calculators
* Dynamic Report Builders

Admin can:

* Create Assessment
* Edit Assessment
* Archive Assessment

---

# Parent Organization Relationship

ParentProfile

↔ ParentOrganization

↔ Organization

A Parent may belong to multiple organizations.

Organization membership must be tracked independently from User roles.

---

# Core Business Rules

BR-01 Email must be unique.

BR-02 Phone number must be unique.

BR-03 Parent may own both:

* Organization children
* Private children

BR-04 Child cannot be both private and organization child.

BR-05 Organization selects winning proposal.

BR-06 Admin approves or rejects selected proposal.

BR-07 Assessment scoring differs per assessment.

BR-08 Reports differ per assessment.

BR-09 Parent-child ownership must be validated before evaluation.

BR-10 Every critical action must be audit logged.

BR-11 RBAC must be enforced on all endpoints.

BR-12 Payment approval must unlock additional parent limits.

BR-13 Transfer requests must be approved before moving a child between parents.

BR-14 Teachers cannot access private children.

BR-15 Organizations cannot access private assessments.

BR-16 Parents can access all children they own.
