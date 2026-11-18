"""Builds docs/NurSet-User-Guide.pdf.

    pip install reportlab
    python docs/build_user_guide.py
"""
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Optional output path: python docs/build_user_guide.py other.pdf
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "NurSet-User-Guide.pdf")
LOGO = os.path.join(ROOT, "src", "assets", "app-logo.png")

PRIMARY = colors.HexColor("#4a86d4")
PRIMARY_DARK = colors.HexColor("#2f5f9e")
PRIMARY_SOFT = colors.HexColor("#e9f1fc")
TEAL = colors.HexColor("#1e9488")
TEAL_SOFT = colors.HexColor("#e3f5f4")
PURPLE = colors.HexColor("#6d4fd1")
PURPLE_SOFT = colors.HexColor("#f1ecfe")
AMBER_SOFT = colors.HexColor("#fdf3e1")
AMBER = colors.HexColor("#b7791f")
RED_SOFT = colors.HexColor("#fdecef")
RED = colors.HexColor("#c93a52")
TEXT = colors.HexColor("#1b2333")
MUTED = colors.HexColor("#5d6779")
BORDER = colors.HexColor("#dfe5ee")
BG = colors.HexColor("#f4f7fb")

W, H = A4
MARGIN = 18 * mm

# ---------- styles ----------
base = ParagraphStyle("base", fontName="Helvetica", fontSize=9.6, leading=14.2, textColor=TEXT)
body = ParagraphStyle("body", parent=base, spaceAfter=6)
muted = ParagraphStyle("muted", parent=base, textColor=MUTED)
small = ParagraphStyle("small", parent=base, fontSize=8.3, leading=11.5, textColor=MUTED)
h1 = ParagraphStyle("h1", parent=base, fontName="Helvetica-Bold", fontSize=19, leading=24, spaceAfter=4, textColor=TEXT)
lead = ParagraphStyle("lead", parent=base, fontSize=10.4, leading=15.5, textColor=MUTED, spaceAfter=12)
h2 = ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=12.5, leading=17, spaceBefore=12, spaceAfter=5, keepWithNext=1)
h3 = ParagraphStyle("h3", parent=base, fontName="Helvetica-Bold", fontSize=10.2, leading=14, spaceBefore=4, spaceAfter=2, keepWithNext=1)
eyebrow = ParagraphStyle("eyebrow", parent=base, fontName="Helvetica-Bold", fontSize=8, leading=10,
                         textColor=PRIMARY, spaceAfter=3)
cell = ParagraphStyle("cell", parent=base, fontSize=8.8, leading=12.4)
cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold")
cell_head = ParagraphStyle("cell_head", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)


def P(text, style=body):
    return Paragraph(text, style)


def menu(path):
    """Menu path like Settings > Account, in bold."""
    return f"<b>{path}</b>"


# ---------- flowables ----------
class Callout(Flowable):
    """Rounded tinted box with a title and text."""

    def __init__(self, title, text, fill=PRIMARY_SOFT, accent=PRIMARY, width=None):
        super().__init__()
        self.title, self.text, self.fill, self.accent = title, text, fill, accent
        self.width = width
        self.para = Paragraph(f"<b>{title}</b><br/>{text}", ParagraphStyle("co", parent=base, fontSize=9.2, leading=13.4))

    def wrap(self, aw, ah):
        self.width = self.width or aw
        _, h = self.para.wrap(self.width - 26, ah)
        self.height = h + 18
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(self.fill)
        c.setStrokeColor(self.fill)
        c.roundRect(0, 0, self.width, self.height, 7, fill=1, stroke=0)
        c.setFillColor(self.accent)
        c.roundRect(0, 0, 4, self.height, 2, fill=1, stroke=0)
        self.para.drawOn(c, 15, 9)


class Steps(Flowable):
    """Numbered steps: circle number + bold title + text."""

    def __init__(self, items, color=PRIMARY):
        super().__init__()
        self.items = items
        self.color = color
        self.paras = [Paragraph(f"<b>{t}</b><br/>{d}", ParagraphStyle("st", parent=base, fontSize=9.4, leading=13.6))
                      for t, d in items]

    def wrap(self, aw, ah):
        self.width = aw
        self.heights = [p.wrap(aw - 34, ah)[1] for p in self.paras]
        self.height = sum(self.heights) + 9 * len(self.paras)
        return aw, self.height

    def split(self, aw, ah):
        # Allow long step lists to continue on the next page.
        self.wrap(aw, ah)
        used, n = 0, 0
        for h in self.heights:
            if used + h + 9 > ah:
                break
            used += h + 9
            n += 1
        if n == 0 or n == len(self.items):
            return []
        first = Steps(self.items[:n], self.color)
        rest = Steps(self.items[n:], self.color)
        rest.offset = getattr(self, "offset", 0) + n
        first.offset = getattr(self, "offset", 0)
        return [first, rest]

    def draw(self):
        c = self.canv
        y = self.height
        start = getattr(self, "offset", 0)
        for i, (p, h) in enumerate(zip(self.paras, self.heights)):
            y -= h
            cy = y + h - 8
            c.setFillColor(self.color)
            c.circle(10, cy, 9, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawCentredString(10, cy - 3, str(start + i + 1))
            p.drawOn(c, 30, y)
            y -= 9


class FlowDiagram(Flowable):
    """Two columns (Clinical Instructor | Nursing Student); steps go top to bottom."""

    STEPS = [
        ("s", "Registers, then gives the instructor their email or student ID"),
        ("c", "Creates a clinical group and adds the student"),
        ("c", "Assigns duties and requirements, sends instructions and announcements"),
        ("s", "Sees them in Duty Schedule, Requirements, CI Notes, Announcements, and the bell"),
        ("s", "Uploads documents and prepares with the Duty Checklist"),
        ("c", "Reviews documents: approves, or sends back with feedback"),
        ("c", "On the duty day, takes attendance and sees each student's readiness"),
        ("c", "After the duty, rates performance and confirms clinical hours"),
        ("s", "Reads the feedback and tracks hours and progress"),
    ]
    ROW = 37
    BOX_H = 28
    HEAD = 26

    def wrap(self, aw, ah):
        self.width = aw
        self.height = self.HEAD + 8 + self.ROW * len(self.STEPS)
        return aw, self.height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        gutter = 22
        col_w = (w - gutter) / 2
        lanes = {"c": (0, TEAL, TEAL_SOFT, "Clinical Instructor"), "s": (col_w + gutter, PRIMARY, PRIMARY_SOFT, "Nursing Student")}
        # lane backgrounds + headers
        for x, col, soft, label in lanes.values():
            c.setFillColor(soft)
            c.roundRect(x, 0, col_w, h, 8, fill=1, stroke=0)
            c.setFillColor(col)
            c.roundRect(x, h - self.HEAD, col_w, self.HEAD, 8, fill=1, stroke=0)
            c.rect(x, h - self.HEAD, col_w, 8, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(x + col_w / 2, h - self.HEAD + 9, label)

        pad = 10
        box_w = col_w - 2 * pad
        boxes = []
        for i, (lane, text) in enumerate(self.STEPS):
            x0, col, soft, _ = lanes[lane]
            x = x0 + pad
            y = h - self.HEAD - 8 - (i + 1) * self.ROW + (self.ROW - self.BOX_H) / 2
            c.setFillColor(colors.white)
            c.setStrokeColor(col)
            c.setLineWidth(0.8)
            c.roundRect(x, y, box_w, self.BOX_H, 5, fill=1, stroke=1)
            c.setFillColor(col)
            c.circle(x + 13, y + self.BOX_H / 2, 7.5, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + 13, y + self.BOX_H / 2 - 2.8, str(i + 1))
            # wrap text to two lines
            font, size = "Helvetica", 7.9
            words, lines, cur = text.split(), [], ""
            for wd in words:
                t = (cur + " " + wd).strip()
                if c.stringWidth(t, font, size) > box_w - 34:
                    lines.append(cur)
                    cur = wd
                else:
                    cur = t
            lines.append(cur)
            c.setFillColor(TEXT)
            c.setFont(font, size)
            ty = y + self.BOX_H / 2 + (len(lines) - 1) * 4.6 - 2.6
            for ln in lines[:2]:
                c.drawString(x + 27, ty, ln)
                ty -= 9.2
            boxes.append((lane, x, y, box_w))

        c.setStrokeColor(MUTED)
        c.setFillColor(MUTED)
        c.setLineWidth(0.8)
        for (la, xa, ya, bw), (lb, xb, yb, _) in zip(boxes, boxes[1:]):
            if la == lb:
                cx = xa + bw / 2
                c.line(cx, ya, cx, yb + self.BOX_H + 3)
                self._head(c, cx, yb + self.BOX_H + 0.5, -90)
            else:
                # from the side facing the other lane, across, then down
                sx = xa + bw if la == "c" else xa
                my = ya + self.BOX_H / 2
                tx = xb + (bw * 0.18 if lb == "s" else bw * 0.82)
                c.line(sx, my, tx, my)
                c.line(tx, my, tx, yb + self.BOX_H + 3)
                self._head(c, tx, yb + self.BOX_H + 0.5, -90)

    @staticmethod
    def _head(c, x, y, angle):
        c.saveState()
        c.translate(x, y)
        c.rotate(angle)
        p = c.beginPath()
        p.moveTo(0, 0)
        p.lineTo(-5, 2.6)
        p.lineTo(-5, -2.6)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        c.restoreState()


def table(rows, widths, head_color=PRIMARY, zebra=True):
    data = [[Paragraph(x, cell_head) for x in rows[0]]]
    for r in rows[1:]:
        data.append([Paragraph(r[0], cell_b)] + [Paragraph(x, cell) for x in r[1:]])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), head_color),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(("BACKGROUND", (0, i), (-1, i), BG))
    t.setStyle(TableStyle(style))
    return t


# ---------- page decorations ----------
def cover(c, doc):
    c.saveState()
    c.setFillColor(BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # top band
    c.setFillColor(PRIMARY_DARK)
    c.rect(0, H - 120 * mm, W, 120 * mm, fill=1, stroke=0)
    c.setFillColor(PRIMARY)
    p = c.beginPath()
    p.moveTo(0, H - 120 * mm)
    p.lineTo(W, H - 95 * mm)
    p.lineTo(W, H - 120 * mm)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    # logo card
    card = 62 * mm
    cx, cy = (W - card) / 2, H - 105 * mm
    c.setFillColor(colors.white)
    c.roundRect(cx, cy, card, card, 14, fill=1, stroke=0)
    c.drawImage(LOGO, cx + 5 * mm, cy + 5 * mm, card - 10 * mm, card - 10 * mm, mask="auto")
    # titles
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(W / 2, H - 140 * mm, "NurSet User Guide")
    c.setFont("Helvetica", 12.5)
    c.setFillColor(MUTED)
    c.drawCentredString(W / 2, H - 150 * mm, "How the app works for clinical instructors and nursing students")
    # two role chips
    chip_w, chip_h = 70 * mm, 26 * mm
    gap = 8 * mm
    x0 = (W - 2 * chip_w - gap) / 2
    y0 = H - 190 * mm
    for i, (title, sub, col, soft) in enumerate((
        ("Clinical Instructor", "Groups, duties, reviews,\nattendance, evaluations", TEAL, TEAL_SOFT),
        ("Nursing Student", "Schedule, requirements, checklist,\nnotes, progress", PRIMARY, PRIMARY_SOFT),
    )):
        x = x0 + i * (chip_w + gap)
        c.setFillColor(soft)
        c.roundRect(x, y0, chip_w, chip_h, 9, fill=1, stroke=0)
        c.setFillColor(col)
        c.roundRect(x, y0, 4, chip_h, 2, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 11.5)
        c.drawString(x + 9 * mm, y0 + chip_h - 9 * mm, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8.6)
        for j, ln in enumerate(sub.split("\n")):
            c.drawString(x + 9 * mm, y0 + chip_h - 15 * mm - j * 11, ln)
    # footer
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED)
    c.drawCentredString(W / 2, 24 * mm, "NurSet desktop app  ·  Version 0.1.0  ·  November 2026")
    c.restoreState()


def page(c, doc):
    c.saveState()
    c.setFillColor(PRIMARY)
    c.rect(0, H - 6, W, 6, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(PRIMARY_DARK)
    c.drawString(MARGIN, H - 12 * mm, "NurSet User Guide")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawRightString(W - MARGIN, H - 12 * mm, doc.section if hasattr(doc, "section") else "")
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(MARGIN, 14 * mm, W - MARGIN, 14 * mm)
    c.drawRightString(W - MARGIN, 9 * mm, f"Page {doc.page}")
    c.drawString(MARGIN, 9 * mm, "For nursing students and clinical instructors")
    c.restoreState()


class Section(Flowable):
    """Invisible marker that sets the running header text."""

    def __init__(self, name):
        super().__init__()
        self.name = name

    def wrap(self, aw, ah):
        return 0, 0

    def draw(self):
        self.canv._doctemplate.section = self.name


def chapter(title, kicker, intro, color=PRIMARY):
    st = ParagraphStyle("k", parent=eyebrow, textColor=color)
    return [Section(title), P(kicker.upper(), st), P(title, h1), P(intro, lead)]


# ---------- content ----------
story = [NextPageTemplate("main"), PageBreak()]

# 1. Overview
story += chapter(
    "How NurSet works",
    "Overview",
    "NurSet connects nursing students with their clinical instructor (CI). The instructor organizes the "
    "clinical rotation (duties, requirements, reviews, attendance, and evaluations), and every action "
    "shows up on the student's side automatically.",
)
story += [
    P("Two kinds of accounts", h2),
    table([
        ["", "Nursing Student", "Clinical Instructor"],
        ["How to get one", "Sign up on the <b>Register</b> screen.", "Created by your school or NurSet administrator (students can't create instructor accounts)."],
        ["Signs in with", "Email or student ID + password", "Email + password"],
        ["Lands on", "Home: next duty, tasks, deadlines, study tools", "Instructor Home: groups, today's duties, documents to review"],
        ["Main job in NurSet", "Prepare for duty, submit requirements, follow instructions, track progress", "Organize groups, assign work, review documents, take attendance, evaluate"],
    ], [34 * mm, 68 * mm, 72 * mm]),
    Spacer(1, 12),
    P("The flow between instructor and student", h2),
    P("Follow the numbers from top to bottom. When an arrow crosses to the other column, what one person did now appears on the other person's pages.", muted),
    Spacer(1, 6),
    FlowDiagram(),
]

# 2. Getting started
story += [PageBreak()]
story += chapter(
    "Getting started",
    "Accounts and sign-in",
    "Do these once. After that, use the role guide that fits you: Clinical Instructor (page 4) or Nursing Student (page 6).",
)
story += [
    Callout("The one link that makes it all work",
            "A student only receives duties, requirements, instructions, and group announcements, and the instructor "
            "only sees that student's documents, readiness, and progress, <b>after the instructor adds the student to a "
            "clinical group</b> (My Groups &gt; Add student, using the student's email or student ID).",
            fill=AMBER_SOFT, accent=AMBER),
    Spacer(1, 2),
    P("Nursing students: create your account", h2),
    Steps([
        ("Open NurSet and choose Create an account", "On the sign-in screen, click <b>Create an account</b>."),
        ("Fill in your details", "First name, middle name (optional), last name, email, school, year level, and student ID (optional, but it lets your instructor find you and you can sign in with it)."),
        ("Choose a password", "At least 8 characters. Read and accept the Terms of Use and Privacy Policy (click the links to open them)."),
        ("Give your instructor your email or student ID", "Until your instructor adds you to their clinical group, they can't see your uploads, and the Requirements page shows a <i>No clinical instructor yet</i> notice."),
    ]),
    P("Clinical instructors: sign in", h2),
    P("Your administrator creates your account and gives you your email and a temporary password. After signing in, change it in "
      + menu("Settings &gt; Privacy &amp; Security &gt; Change Password") + " and update your name and school in " + menu("Settings &gt; Account") + "."),
    P("Signing in and out", h2),
    P("&bull; <b>Keep me signed in</b> (ticked) keeps you signed in on this computer for 30 days, even after you close NurSet. "
      "Untick it on shared computers (school lab, hospital station): you'll be signed out when you close NurSet. "
      "NurSet remembers your choice for next time.<br/>"
      "&bull; <b>Log out</b> is the red button at the bottom of the sidebar. Always log out on shared computers.<br/>"
      "&bull; See and sign out other devices in " + menu("Settings &gt; Privacy &amp; Security &gt; Active Sessions") + ".<br/>"
      "&bull; Forgot your password? Self-service reset isn't available yet. Ask your instructor or administrator for help."),
    P("Your picture and notifications", h2),
    P("&bull; <b>Profile picture:</b> in " + menu("Settings &gt; Account") + ", click your photo (blue camera badge). "
      "It shows in the sidebar and beside the bell.<br/>"
      "&bull; <b>Notification bell:</b> a red count of unread updates (duties, requirements, reviews, deadlines, announcements). "
      "Click one to open it; choose the kinds in " + menu("Settings &gt; Notifications") + "."),
    Callout("Patient confidentiality",
            "Never type or upload anything that identifies a patient (names, hospital numbers, photos, birthdates, addresses) "
            "in tasks, notes, documents, or study materials. Case write-ups and drug studies must be fully de-identified.",
            fill=RED_SOFT, accent=RED),
]

# 3. Instructor guide
story += [PageBreak()]
story += chapter(
    "Clinical Instructor guide",
    "For clinical instructors",
    "Your sidebar: Home, My Groups, Duty Assignments, Requirements &amp; Reviews, Instructions, Duty Day, "
    "Evaluations &amp; Hours, and Announcements. Work through them roughly in this order.",
    color=TEAL,
)
story += [
    P("Set up your groups (start here)", h2),
    Steps([
        ("Create a group", menu("My Groups &gt; New Group") + ". Give it a name (e.g. <i>BSN 3-A &middot; Group 1</i>), and optionally the area, hospital, term, and a color."),
        ("Add students", "Open the group and add each student by <b>email or student ID</b>. They must have registered first. "
                         "New members automatically receive the group's upcoming duties and open requirements."),
        ("Keep it tidy", "Remove students who change groups; edit or delete the group from its page."),
    ], color=TEAL),
    P("Plan the rotation", h2),
    Steps([
        ("Assign duties", menu("Duty Assignments &gt; New") + ": pick the group, area, hospital, date, and shift times. "
                          "Each member gets the duty in their <b>Duty Schedule</b> and Home. Editing or deleting it updates everyone."),
        ("Assign requirements", menu("Requirements &amp; Reviews &gt; Requirements tab") + ": add a requirement (title, details, due date) for a group. "
                                "It appears in each member's requirements and deadlines."),
        ("Send instructions", menu("Instructions &gt; New Instruction") + ": send to a whole group or one student. "
                              "It appears in their <b>CI Notes</b>. Mark it <b>Important</b> to show it as the CI reminder on their Home and Duty Checklist."),
        ("Post announcements", menu("Announcements &gt; New Announcement") + ": choose Important, Academic, or Reminder, and send to one group or all your groups."),
    ], color=TEAL),
    P("Review documents", h2),
    Steps([
        ("Open the Reviews tab", menu("Requirements &amp; Reviews &gt; Reviews") + " lists documents your students submitted. The bell also tells you when new ones arrive."),
        ("Open the file", "Click the document to view it. Use <b>Mark as under review</b> so the student knows you're checking it."),
        ("Decide", "<b>Approve</b>, or <b>Send back for revision</b> with feedback (feedback is required). The student sees the status and your comments right away."),
    ], color=TEAL),
    P("On the duty day", h2),
    Steps([
        ("Open Duty Day", "It shows today's students grouped by shift, with readiness dots from each student's Duty Checklist. Use the arrows or date picker for other days."),
        ("Take attendance", "Mark each student <b>Present, Late, Absent, or Excused</b>. Time in is filled for present/late students (you can edit it), and you can add remarks."),
    ], color=TEAL),
    P("After the duty", h2),
    Steps([
        ("Evaluate", menu("Evaluations &amp; Hours") + " lists completed duties to evaluate. Rate <b>Knowledge, Clinical skills, Professionalism, and Communication</b> from 1 to 5 stars."),
        ("Confirm hours", "Enter the clinical hours earned (it starts from the scheduled length; absent duties start at 0) and optional comments."),
        ("Track totals", "The Students table shows each student's completed duties, confirmed hours, and average rating."),
    ], color=TEAL),
    Spacer(1, 6),
    KeepTogether([
        P("Instructor checklist", h3),
        table([
            ["When", "What to do", "Where"],
            ["Start of rotation", "Create groups, add students, assign duties and requirements", "My Groups, Duty Assignments, Requirements &amp; Reviews"],
            ["Every week", "Review new documents, send instructions, post announcements", "Requirements &amp; Reviews, Instructions, Announcements"],
            ["Each duty day", "Take attendance, check readiness", "Duty Day"],
            ["After each duty", "Evaluate and confirm hours", "Evaluations &amp; Hours"],
        ], [32 * mm, 80 * mm, 62 * mm], head_color=TEAL),
    ]),
]

# 4. Student guide
story += [PageBreak()]
story += chapter(
    "Nursing Student guide",
    "For nursing students",
    "Your sidebar: Home, Duty Schedule, Requirements, Tasks, Duty Checklist, AI Study, CI Notes, Progress, "
    "Announcements, and Quick Links. AI Study and Quick Links are Premium (gold crown). Here is a typical week.",
)
story += [
    P("Every day: start at Home", h2),
    P("Home shows your next clinical duty, today's tasks, upcoming deadlines, and the CI reminder. Add a quick task straight from Home. "
      "Check the bell for new duties, reviews, and announcements."),
    P("Know your schedule", h2),
    Steps([
        ("Check Duty Schedule", "Duties your instructor assigns appear automatically on the calendar."),
        ("Add your own entries", "Use <b>Add</b> to record other duties, exams, or school events so everything is in one calendar."),
    ]),
    P("Submit requirements", h2),
    Steps([
        ("Open Requirements", "See what's due, including requirements assigned by your instructor."),
        ("Upload a document", "Click <b>Upload Document</b>, then drag and drop the file (or browse). Accepted: <b>PDF, DOCX, JPG, PNG</b>, up to 25 MB. "
                              "Photos and scans show a <b>preview</b> so you can check it's the right image. Choose the type and give it a title that matches the requirement."),
        ("Follow the status", "<b>Pending</b> means waiting for review, <b>Under review</b> means your CI is checking it, <b>Approved</b> means done, "
                              "<b>Needs revision</b> means read the feedback, fix it, and upload again."),
        ("Check what you sent", "Click a document to see its details and your instructor's feedback, and use <b>Open file</b> to view it."),
    ]),
    Callout("Don't see your instructor's review?",
            "If the Requirements page shows <i>No clinical instructor yet</i>, your instructor hasn't added you to their group. "
            "Send them your email or student ID.", fill=AMBER_SOFT, accent=AMBER),
    Spacer(1, 4),
    P("Get ready for duty", h2),
    Steps([
        ("Open Duty Checklist", "Pick the duty. Tick the <b>readiness checks</b>. Your instructor sees these as readiness dots on Duty Day."),
        ("Pack your duty bag", "Use the bag list and the rotation checklist for your area; add your own items with <b>Add Checklist Items</b>."),
        ("Read the CI reminder", "Important instructions from your instructor show here and on Home."),
    ]),
    P("Stay organized", h2),
    table([
        ["Page", "Use it to"],
        ["Tasks", "Plan study and duty prep: category, priority, subject, due date and time. Tick tasks off when done."],
        ["CI Notes", "Read your instructor's instructions and keep your own notes per duty. Pin the important ones."],
        ["Announcements", "Read posts from your instructor and your nursing department."],
        ["Progress", "See duties completed, tasks done, requirements submitted, and your study streak for the week or month."],
        ["Settings", "Update your profile and photo, change your password, choose notifications, export your data."],
    ], [34 * mm, 140 * mm]),
    Spacer(1, 10),
    KeepTogether([
        P("Student checklist", h3),
        table([
            ["When", "What to do"],
            ["Once", "Register, then send your email or student ID to your instructor"],
            ["Every day", "Check Home and the bell; update Tasks"],
            ["Before each duty", "Complete the Duty Checklist and readiness checks; read CI Notes"],
            ["When something is due", "Upload the document in Requirements; fix and re-upload if it needs revision"],
            ["Weekly", "Review Progress and Announcements"],
            ["When studying (Premium)", "Ask NurSet AI, take an AI quiz in Quizlab, and read its feedback"],
        ], [44 * mm, 130 * mm]),
    ]),
]


# 5. AI Study (Premium)
story += [PageBreak()]
story += chapter(
    "AI Study",
    "Premium study tools",
    "AI Study is powered by Google Gemini and only helps with nursing studies. It has three parts: the AI assistant chat, "
    "AI-written quizzes in Quizlab, and AI feedback after each quiz.",
    color=PURPLE,
)
story += [
    P("Ask NurSet AI (chat)", h2),
    Steps([
        ("Open the assistant", menu("AI Study &gt; AI Assistant") + ", or use the AI panel on Home. Pick a suggestion or type your question."),
        ("Ask about your lessons", "Concepts, drugs, care plans, procedures, duty prep, NLE review; add notes with <b>+</b> to have them explained. "
                                   "It remembers the conversation. Non-nursing questions get a polite refusal, and answers are for studying only: "
                                   "check doses and procedures with your references and CI."),
        ("Delete your chat", "<b>Delete chat</b> (top right) permanently deletes the conversation and removes it from your recent study activity."),
    ], color=PURPLE),
    P("Make a quiz with AI (Quizlab)", h2),
    Steps([
        ("Set up the quiz", menu("AI Study &gt; Quizlab") + ": type a nursing topic, optionally paste your notes, choose question types "
                            "(multiple choice, true or false, identification, case-based) and how many questions."),
        ("Generate", "Click <b>Generate Quiz with AI</b>. NurSet AI writes the questions in a few seconds, using your notes when you add them."),
        ("Answer and finish", "Pick an answer for each question (use the hint if you're stuck; the explanation appears after you answer), "
                              "then click <b>Finish</b> to see your score."),
    ], color=PURPLE),
    P("Get AI feedback", h2),
    P("After you finish, NurSet AI reviews your answers and shows: a short <b>summary</b>, <b>what you did well</b>, "
      "<b>topics to review</b> (what you missed and the correct idea), and <b>next steps</b>. Open it again any time with "
      "<b>Results &amp; feedback</b> on the quiz page. <b>Retake</b> clears your answers and gives you a fresh review next time."),
    Spacer(1, 4),
    KeepTogether([
        P("Daily limits", h3),
        table([
            ["Feature", "Limit per student", "When the limit is reached"],
            ["AI chat", "50 messages a day", "Messages can't be sent until tomorrow"],
            ["AI quizzes", "5 a day, up to 30 questions each", "Quizzes use NurSet's built-in practice questions"],
            ["AI feedback", "10 reviews a day", "You get basic feedback (score and the questions you missed)"],
        ], [30 * mm, 56 * mm, 88 * mm], head_color=PURPLE),
        P("Limits reset at midnight. If NurSet AI is busy, quizzes and feedback still work using built-in questions and basic feedback.", small),
    ]),
    Spacer(1, 8),
    Callout("What gets sent to Google",
            "Your chat messages, Quizlab topics and notes, and quiz answers are sent to Google Gemini to write replies, quizzes, and feedback. "
            "Your name and email are not. Google may use this content to improve its products, so <b>never type patient names or other "
            "identifying details</b>, and remember that AI answers can be wrong.",
            fill=RED_SOFT, accent=RED),
]

# 6. Premium
story += [PageBreak()]
story += chapter(
    "Free and Premium",
    "Plans",
    "Core clinical features are free for every student. Premium adds study tools and personalization. "
    "Clinical instructors have Premium appearance options included.",
    color=PURPLE,
)
story += [
    table([
        ["Feature", "Free", "Premium"],
        ["Home, Duty Schedule, Requirements, Tasks, Duty Checklist, CI Notes, Progress, Announcements", "Yes", "Yes"],
        ["Notification bell (duties, deadlines, reviews, announcements)", "Yes", "Yes"],
        ["Font size and layout density", "Yes", "Yes"],
        ["AI Study: NurSet AI chat, AI-written Quizlab quizzes, and AI quiz feedback", "Locked", "Yes"],
        ["Quick Links: Learning Hub, upload study materials, Nursing Student Handbook", "Locked", "Yes"],
        ["Dark mode and accent colors", "Locked", "Yes"],
        ["Study reminders and Learning Hub notifications", "No", "Yes"],
    ], [118 * mm, 28 * mm, 28 * mm], head_color=PURPLE),
    Spacer(1, 10),
    P("Locked items show a gold crown in the sidebar. Opening one shows what Premium includes with an <b>Upgrade to Premium</b> button. "
      "Manage your plan in " + menu("Settings &gt; Subscription &amp; Billing") + ". Cancelling locks Premium features again and returns the theme to default."),
    Callout("Preview pricing",
            "Premium checkout in this version is a preview: no payment is collected and nothing is charged.",
            fill=PURPLE_SOFT, accent=PURPLE),
    PageBreak(),
    Section("Troubleshooting"),
    P("HELP", eyebrow),
    P("Troubleshooting", h1),
    P("Quick fixes for the most common questions.", lead),
    table([
        ["Problem", "What to do"],
        ["Instructor doesn't see a student's documents", "The student isn't in the instructor's group yet. Add them in My Groups using their email or student ID."],
        ["Student doesn't get duties or requirements", "Same cause: they must be in the group. Students added later automatically receive upcoming duties and open requirements."],
        ["\"Incorrect email, student ID, or password\"", "Check the spelling and Caps Lock. Instructors sign in with email. If it still fails, ask the administrator to reset the password."],
        ["\"Can't reach the NurSet server\"", "NurSet needs the internet. Check your connection and try again. If no one used NurSet for a while, the server can take up to a minute to wake up."],
        ["An opened file or export link stopped working", "Files and data exports open through a secure link that works for 5 minutes. Open the file again from NurSet."],
        ["A page says \"This is a NurSet Premium feature\"", "That feature needs Premium. See Settings &gt; Subscription &amp; Billing."],
        ["\"NurSet AI is busy right now\"", "The shared free AI limit was reached. Wait a minute and try again. Quizzes and feedback still work with built-in questions."],
        ["\"You've reached today's limit\"", "You've used today's AI messages, quizzes, or reviews. They reset at midnight."],
        ["\"Quizlab only makes nursing quizzes\"", "Use a nursing topic, for example Pharmacology or Fundamentals of Nursing."],
        ["\"Unsupported file type\" when uploading", "Requirements accept PDF, DOCX, JPG, and PNG files up to 25 MB. Save Word files as .docx."],
    ], [58 * mm, 116 * mm]),
    Spacer(1, 10),
    P("Your data and privacy", h2),
    P("Your records are private to your account. Your instructor sees only what's needed to supervise your rotation. "
      "Export a copy of your data in " + menu("Settings &gt; Privacy &amp; Security &gt; Data Export") + ", and read the full "
      "Terms of Use and Privacy Policy in " + menu("Settings &gt; Help &amp; Support") + "."),
]


# ---------- build ----------
class GuideDoc(BaseDocTemplate):
    pass


os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = GuideDoc(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=20 * mm, bottomMargin=20 * mm,
               title="NurSet User Guide", author="NurSet",
               subject="How NurSet works for clinical instructors and nursing students")
doc.section = ""
frame = Frame(MARGIN, 20 * mm, W - 2 * MARGIN, H - 40 * mm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[Frame(0, 0, W, H, id="c")], onPage=cover),
    PageTemplate(id="main", frames=[frame], onPageEnd=page),
])
doc.build([Spacer(1, 1)] + story)
print("wrote", OUT)
