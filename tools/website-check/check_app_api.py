"""
Checks the Qumanity website API exactly the way the phone app uses it
(JSON + "Authorization: Bearer" token, no cookies).

Safe to run at any time: it works on a TEMPORARY COPY of the website database
and sends 0_Earth folder writes to a temporary folder, then deletes both.

    python3 tools/website-check/check_app_api.py [path/to/Qumanity_DPG]
"""
import json, os, shutil, sys, tempfile
from pathlib import Path

DPG = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "Desktop/Qumanity_DPG").resolve()
TMP = Path(tempfile.mkdtemp(prefix="qm-check-"))
shutil.copy(DPG / "qumanity_prototype.db", TMP / "copy.db")
(TMP / "earth").mkdir()
os.environ["QM_EARTH_ROOT"] = str(TMP / "earth")
os.chdir(DPG)
sys.path.insert(0, str(DPG))

import db  # noqa: E402  (website module)
db.DB_PATH = TMP / "copy.db"
import app as A  # noqa: E402

fails = []
def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label + (f"  [{extra}]" if not cond and extra else ""))
    if not cond: fails.append(label)

c = A.app.test_client(use_cookies=False)
def call(method, path, tok=None, body=None):
    h = {"Authorization": f"Bearer {tok}"} if tok else {}
    r = c.open(path, method=method, headers=h, json=body)
    return r.status_code, (r.get_json(silent=True) or {})

def login(pid, pin):
    s, b = call("POST", "/login", body={"private_id": pid, "pin": pin, "client": "app"}); return b.get("token")

# --- registration exactly as the app builds it (toStruct keeps only scalar fields of each node) ---
def strip(n): return {k: v for k, v in n.items() if not isinstance(v, (list, dict))}
world = json.load(open("static/data/global_countries.json"))
sub = json.load(open("static/data/subcontinent_states.json"))
dist = json.load(open("static/data/subcontinent_districts.json"))
asia = next(x for x in world["continents"] if x["id"] == "O_AS")
india = next(x for x in asia["countries"] if x["id"] == "O_AS_IND")
ind = next(x for x in sub["countries"] if x["code"] == "IND")
zone = next(z for z in ind["zones"] if z["id"] == "IND/CS"); state = next(s for s in zone["states"] if s["id"] == "CS.DL")
d = next(x for x in dist["states"]["CS.DL"]["districts"] if x["id"] == "CS.DL.5"); t = next(x for x in d["tehsils"] if x["id"] == "CS.DL.5.4")
s_, vj = call("GET", "/api/india-villages/CS.DL.5.4"); village = vj["villages"][0]
present = {"continent": strip(asia), "country": strip(india), "zone": strip(zone), "state": strip(state), "district": strip(d), "tehsil": strip(t), "village": village}
europe = next(x for x in world["continents"] if x["id"] == "O_EU"); france = next(x for x in europe["countries"] if x["id"] == "O_EU_FRA")
birth_abroad = {"continent": strip(europe), "country": strip(france)}

def register(name, gender, dob, birth):
    s, b = call("POST", "/api/auth/register", body={"name": name, "gender": gender, "dob": dob, "tob": "06:30", "pin": "48291",
        "language": "Hindi", "phone": "+919999900000", "birth_location": birth, "present_location": present, "client": "app"})
    return s, b
s, a = register("Asha Test", "female", "1996-08-02", present)
check("register (born + living in a Delhi village)", s == 201 and len(a.get("private_code", "")) == 9 and a.get("token"), (s, a.get("error")))
s, b = register("Bharat Test", "male", "1990-01-25", birth_abroad)
check("register (born in France, living in Delhi)", s == 201 and b.get("token"), (s, b.get("error")))
A_tok, B_tok = a["token"], b["token"]
check("sign in again with Private ID + PIN", bool(login(a["private_code"], "48291")))

# --- profile, board, council, groups ---
s, me = call("GET", "/api/me", A_tok); check("/api/me", s == 200 and me.get("present_location_struct", {}).get("village", {}).get("id") == village["id"])
for lvl in ["village", "tehsil", "district", "state", "zone", "country", "continent", "earth"]:
    s, bd = call("GET", f"/api/board/{lvl}", A_tok); check(f"board {lvl}", s == 200 and "posts" in bd, s)
    s, qp = call("GET", f"/api/qpunch/{lvl}", A_tok); check(f"q-punch {lvl} has 5 seats", s == 200 and len(qp.get("seats", [])) == 5, s)
s, p = call("POST", "/api/board/post", A_tok, {"level": "village", "content": "Clean the village pond on Sunday"}); check("post in village", s == 201, p)
s, v = call("POST", "/api/board/vote", B_tok, {"post_id": p.get("id"), "value": 1}); check("neighbour votes +1", s == 200 and v.get("score") == 1, v)
s, bd = call("GET", "/api/board/village", A_tok); post = next((x for x in bd["posts"] if x["id"] == p.get("id")), {})
check("board shows the post, score and vote state", post.get("score") == 1 and post.get("can_vote") is True and post.get("mine") is True)
s, e = call("POST", "/api/board/comment", A_tok, {"post_id": p.get("id"), "text": "hi"}); check("comment refused while voting is open", s >= 400)
s, _ = call("GET", "/api/subgroups", A_tok); check("village sub-groups", s == 200)

# --- personal timeline: search, message request, invitation, chats ---
s, pm = call("GET", "/api/people/me", B_tok); code_b = pm.get("search_code")
check("12-digit search code", s == 200 and code_b and len(code_b) == 12)
s, found = call("GET", f"/api/people/search?q={code_b}", A_tok); check("find by search code", s == 200 and found.get("name") == "Bharat Test")
s, _ = call("POST", "/api/people/message", A_tok, {"user_id": found["user_id"], "text": "Namaste!"}); check("send message request", s == 201)
s, ib = call("GET", "/api/people/inbox", B_tok); req = next((r for r in ib["requests"] if r["kind"] == "message"), None)
check("request arrives in inbox", req is not None and req["first_message"] == "Namaste!")
s, _ = call("POST", f"/api/people/inbox/{req['id']}/decide", B_tok, {"decision": "accept"}); check("accept request", s == 200)
s, ch = call("GET", "/api/people/chats", A_tok); chat_id = ch["chats"][0]["chat_id"] if ch.get("chats") else None
check("private chat opened", chat_id is not None)
s, _ = call("POST", f"/api/people/chats/{chat_id}", B_tok, {"text": "Hello Asha"}); s2, m = call("GET", f"/api/people/chats/{chat_id}", A_tok)
check("private chat send + read", s == 201 and [x["text"] for x in m["messages"]] == ["Namaste!", "Hello Asha"], m.get("messages"))
# Personal groups are grouped by category (family / friends / business / custom), each {owned, joined}.
s, gs = call("GET", "/api/people/groups", A_tok); fam_a = gs["family"]["owned"][0]
check("default Family groups exist", s == 200 and {g["name"] for g in gs["family"]["owned"]} >= {"Paternal", "Maternal"}, gs.get("family"))
s, _ = call("POST", "/api/people/invite", A_tok, {"group_id": fam_a["id"], "user_id": found["user_id"]}); check("invite to a Family group", s == 201)
s, ib = call("GET", "/api/people/inbox", B_tok); inv = next(r for r in ib["requests"] if r["kind"] == "group")
call("POST", f"/api/people/inbox/{inv['id']}/decide", B_tok, {"decision": "accept"})
s, gs = call("GET", "/api/people/groups", B_tok); fam = next((g for g in gs["family"]["joined"] if g["id"] == fam_a["id"]), None)
check("Bharat sees Asha's Family group", fam is not None and fam.get("owner_name") == "Asha Test", gs.get("family"))
s, _ = call("POST", f"/api/people/groups/{fam_a['id']}/messages", B_tok, {"text": "Hi family"}); s2, gm = call("GET", f"/api/people/groups/{fam_a['id']}/messages", A_tok)
check("group chat send + read", s == 201 and gm["messages"][-1]["text"] == "Hi family")

# --- private account: ID reveal, wallet, history, settings ---
s, pc = call("POST", "/api/user/private-code", A_tok, {"pin": "48291"}); check("reveal Private ID with PIN", s == 200 and pc.get("private_code") == a["private_code"])
s, _ = call("POST", "/api/user/private-code", A_tok, {"pin": "11111"}); check("wrong PIN does not reveal", s == 403)
for path in ["/api/wallet/balance", "/api/wallet/history", "/api/qoins/config", "/api/qoins/preview?amount=289",
             f"/api/wallet/balance/village/{village['id']}", "/api/wallet/balance/earth/EARTH", "/api/election-history",
             "/api/board/removed", f"/api/location/stats/village/{village['id']}", "/api/earth/stats", "/api/zodiac/current"]:
    s, _ = call("GET", path, A_tok); check(f"GET {path}", s == 200, s)
s, q = call("GET", "/api/qoins/preview?amount=289", A_tok); check("289 = 7 Qoins", q.get("qoins") == [200, 50, 20, 10, 5, 2, 2], q.get("qoins"))
# real donations: order -> (Razorpay Checkout) -> verify; without Razorpay keys the website runs "simulated" mode
s, bal0 = call("GET", "/api/wallet/balance", A_tok)
s, od = call("POST", "/api/payment/order", A_tok, {"amount_rupees": 20}); check("payment order created (simulated without keys)", s == 200 and od.get("mode") in ("simulated", "razorpay") and od.get("local_order_id"), od)
s, bal1 = call("GET", "/api/wallet/balance", A_tok); check("…nothing credited before verify", bal1["balance_qoins"] == bal0["balance_qoins"], (bal0, bal1))
s, dn = call("POST", "/api/payment/verify", A_tok, {"local_order_id": od.get("local_order_id")}); check("verify credits Qoins", s == 200 and dn.get("status") == "credited" and dn.get("amount_rupees") == 20, dn)
s, dn2 = call("POST", "/api/payment/verify", A_tok, {"local_order_id": od.get("local_order_id")}); check("an order can't be credited twice", s == 400, dn2)
s, _ = call("POST", "/api/election-history", A_tok, {"loksabha": {"2024": "OTH"}, "vidhansabha": {"last": None, "next": None}})
s2, eh = call("GET", "/api/election-history", A_tok); check("save election history", s == 200 and eh["party"]["loksabha"]["2024"] == "OTH")
s, lg = call("POST", "/api/user/languages", A_tok, {"daily": "Tamil"}); check("set daily language", s == 200 and any(l["name"] == "Tamil" for l in lg["languages"]))
s, pinr = call("POST", "/api/user/pin", A_tok, {"current_pin": "48291", "new_pin": "57302", "client": "app"})
check("change PIN -> new token works, old one not", s == 200 and call("GET", "/api/me", pinr.get("token"))[0] == 200 and call("GET", "/api/me", A_tok)[0] == 401)

# --- "Register a new member": a helper registers someone else and becomes their referrer ---
new_person = {"name": "Chandra Helped", "gender": "male", "dob": "1970-05-10", "tob": "09:00", "pin": "36925",
              "language": "Hindi", "birth_location": present, "present_location": present, "client": "app", "assisted": True}
s, e = call("POST", "/api/auth/register", body=dict(new_person, helper_private_id=b["private_code"], helper_pin="11111"))
check("helper with a wrong PIN is refused before any account is made", s == 403, (s, e))
con_count = lambda: __import__("sqlite3").connect(str(TMP / "copy.db")).execute("SELECT COUNT(*) FROM users WHERE name='Chandra Helped'").fetchone()[0]
check("…and no account was created", con_count() == 0)
s, bal_before = call("GET", "/api/wallet/balance", B_tok)
s, h = call("POST", "/api/auth/register", body=dict(new_person, helper_private_id=b["private_code"], helper_pin="48291", donation_amount=20))
check("helper (app, signed out) registers a new member", s == 201 and h.get("assisted") is True and len(h.get("private_code", "")) == 9 and not h.get("token"), (s, h.get("error")))
row = __import__("sqlite3").connect(str(TMP / "copy.db")).execute("SELECT referred_by_user_id FROM users WHERE name='Chandra Helped'").fetchone()
check("new member's referrer is the helper", row and row[0] == found["user_id"], row)
s, bal_after = call("GET", "/api/wallet/balance", B_tok)
check("assisted registration stays free: an unpaid amount credits nobody", bal_after["balance_qoins"] == bal_before["balance_qoins"], (bal_before["balance_qoins"], bal_after["balance_qoins"]))
check("the new member can sign in with their own ID + PIN", bool(login(h["private_code"], "36925")))
web2 = A.app.test_client()
web2.post("/login", json={"private_id": b["private_code"], "pin": "48291"})
r = web2.post("/api/auth/register", json=dict(new_person, name="Devi Helped", client="web"))
check("website helper (signed in) registers someone and stays signed in as themself",
      r.status_code == 201 and web2.get("/api/me").get_json().get("name") == "Bharat Test", (r.status_code, r.get_json().get("error")))

# --- Account IDs: request a new one, council approves, switch back ---
s, pm = call("GET", "/api/people/me", B_tok); first = pm["account_history"][0]
check("account history carries row ids", s == 200 and "id" in first and first["is_current"] == 1)
moved = dict(present, village={"id": "CS.DL.5.4.2", "name": "Second Village"})
s, e = call("POST", "/api/people/account-ids/request", B_tok, {"present_location": moved}); check("request a new Account ID", s == 201, e)
s, e = call("POST", "/api/people/account-ids/request", B_tok, {"present_location": moved}); check("only one pending request at a time", s == 400, e)
s, pm = call("GET", "/api/people/me", B_tok); check("pending request is visible to the member", any(r["status"] == "pending" for r in pm.get("account_requests", [])))
os.environ["QM_ADMIN_PRIVATE_IDS"] = a["private_code"]
s, adm = call("GET", "/api/admin/account-ids", pinr["token"]); req_id = next(r["id"] for r in adm["requests"] if r["name"] == "Bharat Test")
s, _ = call("POST", f"/api/admin/account-ids/{req_id}/decide", pinr["token"], {"approve": True}); check("council approves it", s == 200)
os.environ.pop("QM_ADMIN_PRIVATE_IDS")
s, meb = call("GET", "/api/me", B_tok); check("new place is now active", meb["present_location_struct"]["village"]["id"] == "CS.DL.5.4.2", meb.get("present_location_struct", {}).get("village"))
s, pm = call("GET", "/api/people/me", B_tok); old = next(r for r in pm["account_history"] if not r["is_current"])
s, _ = call("POST", "/api/people/account-ids/switch", B_tok, {"row_id": old["id"]})
s2, meb = call("GET", "/api/me", B_tok); check("switch back to the old Account ID", s == 200 and meb["present_location_struct"]["village"]["id"] == village["id"])

# --- election history naming and parties (percentages stay hidden until 2028 / the Founder opens them) ---
for lvl, lid, label in (("country", "O_AS_IND", "National Election"), ("state", "CS.DL", "State Election")):
    s, sen = call("GET", f"/api/election-sentiment/{lvl}/{lid}")
    check(f"{lvl} page: '{label}' or the hidden-results reason", s == 200 and ((sen.get("visible") is False and sen.get("reason")) or sen.get("label") == label), sen)
s, eh = call("GET", "/api/election-history", A_tok if call("GET", "/api/me", A_tok)[0] == 200 else pinr["token"])
check("India's 3 parties + Not Voted", [c for c, _ in eh["parties"]] == ["BJP", "INC", "OTH", "NOTVOTED"], eh.get("parties"))

# --- app tour + the one-time rating & review ---
s, ob = call("GET", "/api/onboarding", B_tok); check("new member: tour not seen, no review yet", s == 200 and ob == {"tour": None, "review_done": False}, ob)
s, ob = call("POST", "/api/onboarding/tour", B_tok, {"status": "skipped"}); check("skip the tour", s == 200 and ob["tour"] == "skipped")
s, e = call("POST", "/api/reviews", B_tok, {"rating": 5, "text": "x" * 101}); check("review over 100 characters refused", s == 400, e)
s, e = call("POST", "/api/reviews", B_tok, {"rating": 6, "text": "hi"}); check("rating must be 1-5", s == 400, e)
s, _ = call("POST", "/api/reviews", B_tok, {"rating": 5, "text": "Village voice at last!", "allow_public": True, "client": "app"})
check("rating shared even after skipping the tour", s == 201)
s, e = call("POST", "/api/reviews", B_tok, {"rating": 4, "text": "again"}); check("only one chance per member", s == 409, e)
s, pub = call("GET", "/api/reviews/public"); check("not public until an admin approves", pub["count"] >= 1 and all(r["text"] != "Village voice at last!" for r in pub["reviews"]), pub)
s, _ = call("POST", "/api/reviews", pinr["token"], {"decline": True}); check("'No thanks' uses the chance", s == 201)
s, ob = call("GET", "/api/onboarding", pinr["token"]); check("declined member is not asked again", ob.get("review_done") is True)
os.environ["QM_ADMIN_PRIVATE_IDS"] = a["private_code"]
s, adm = call("GET", "/api/admin/reviews", pinr["token"]); rid = next(r["id"] for r in adm["reviews"] if r["text"] == "Village voice at last!")
s, _ = call("POST", f"/api/admin/reviews/{rid}/approve", pinr["token"], {"approved": True}); check("admin approves a review", s == 200)
s, pub = call("GET", "/api/reviews/public"); shown = next((r for r in pub["reviews"] if r["text"] == "Village voice at last!"), None)
check("approved review shows first name + village only", shown is not None and shown["name"] == "Bharat" and "user_id" not in shown, shown)
os.environ.pop("QM_ADMIN_PRIVATE_IDS")
s, e = call("GET", "/api/admin/reviews", B_tok); check("non-admin cannot list reviews", s == 403)

# --- website dashboard parity: the app's Time-box & Kundali, Perception, referrer, profile-change calls ---
tk = login(a["private_code"], "57302") or pinr.get("token")
for path in ["/api/timebox", "/api/lunar/phase", "/api/karma/me", "/api/referrer/me", "/api/perception/country/O_AS_IND", "/api/perception/zone/IND%2FCS"]:
    s, _ = call("GET", path, tk); check(f"app GET {path}", s == 200, s)
s, pc = call("POST", "/api/dashboard/edit-request", tk, {"phone": "+919000000001", "reason": "new number"}); check("app profile-change request", s in (200, 201), (s, pc))
s, ra = call("POST", "/api/referrer/apply", tk, {"note": "I help my neighbours register"}); check("app referrer application", s == 201, (s, ra))
s, rm = call("GET", "/api/referrer/me", tk); check("…shows as pending", rm.get("pending") is True, rm)

# --- website changes of 2026-10 the app now follows ---
s, reg = call("POST", "/api/auth/register", body={"name": "Devi Payer", "gender": "female", "dob": "1992-02-02", "tob": "07:15", "pin": "24680",
    "language": "Hindi", "birth_location": present, "present_location": present, "client": "app", "donation_amount": 30, "referral_code": "REF-OLD"})
check("self-registration with a donation: account made, ₹30 left to pay online", s == 201 and reg.get("token") and reg.get("donation_pending_amount") == 30, (s, reg.get("error"), reg.get("donation_pending_amount")))
s, od = call("POST", "/api/payment/order", reg.get("token"), {"amount_rupees": 30, "purpose": "registration"})
s, dn = call("POST", "/api/payment/verify", reg.get("token"), {"local_order_id": od.get("local_order_id")}); check("…then the registration payment credits", s == 200 and dn.get("status") == "credited", dn)
s, k = call("GET", "/api/me/kundali", reg.get("token")); check("my Moon-based Kundali (chart + table + dasha)", s == 200 and k.get("chart_svg", "").startswith("<svg") and k.get("table") and k.get("dasha", {}).get("current"), s)
s, me2 = call("GET", "/api/me", reg.get("token")); check("/api/me has birth_location_struct + preferred_language", "birth_location_struct" in me2 and "preferred_language" in me2)
s, lg = call("POST", "/api/user/languages", reg.get("token"), {"preferred": "hi"}); check("set preferred language", s == 200 and lg.get("preferred") == "hi", lg)
s, sb = call("GET", "/api/scoreboard/india"); check("India scoreboard", s == 200 and isinstance(sb.get("total_members"), int) and sb.get("zones"), s)
s, fm = call("GET", "/api/founder-message?lang=hi"); check("Founder's Message", s == 200 and fm.get("full_text"), s)
s, ck = call("GET", f"/api/karma/collective/village/{village['id']}"); check("collective Karma for a place", s == 200 and "points" in ck, ck)
s, pc = call("GET", "/api/perception/country/O_AS_IND", reg.get("token")); check("perception: counts hidden or shown, reason given", s == 200 and (pc.get("results_visible") or pc.get("results_reason")), pc)

# --- monthly sign election, pilot village (Rohini Sector 24): needs the 500 demo residents ---
import datetime as dt, random  # noqa: E401
import election_core as E  # noqa: E402
con = db.get_db(); V = E.PILOT_VILLAGE_ID
has_demo = "is_demo" in {r[1] for r in con.execute("PRAGMA table_info(users)")} and con.execute("SELECT COUNT(*) FROM users WHERE is_demo = 1").fetchone()[0] >= 100
if not has_demo:
    print("SKIP election pilot checks (run Qumanity_DPG/scripts/seed_election_demo.py first)")
else:
    today = dt.date.today(); cyc = E.current_cycle_for_village(con, V)
    sign = cyc["zodiac_sign"]
    member = con.execute("SELECT u.private_id_9digit, u.gender FROM users u JOIN user_zodiac z ON z.user_id = u.id WHERE u.is_demo = 1 AND z.sun_sign = ? "
                         "AND u.id NOT IN (SELECT user_id FROM election_candidates WHERE election_cycle_id = ?) ORDER BY u.id LIMIT 1", (sign, cyc["id"])).fetchone()
    other = con.execute("SELECT u.private_id_9digit FROM users u JOIN user_zodiac z ON z.user_id = u.id WHERE u.is_demo = 1 AND z.sun_sign != ? LIMIT 1", (sign,)).fetchone()
    if member:
        tok = login(member["private_id_9digit"], "24024"); check("demo member signs in with the demo PIN", bool(tok))
        s, qp = call("GET", "/api/qpunch/village", tok); el = qp.get("election") or {}
        check("village Q-Punch carries this month's election", s == 200 and el.get("sign") == sign and len(el.get("weeks", [])) == 4 and el.get("week") == E.current_week(cyc), el.get("week"))
        check("…and this member's guide", (qp.get("guide") or {}).get("my_sign") == sign, qp.get("guide"))
        s, st = call("GET", "/api/election/status", tok); check("election status has guide + 4 weeks", s == 200 and st.get("guide") and len(st.get("weeks", [])) == 4)
        s, ns = call("GET", "/api/notifications/summary", tok)
        check("bell counts the election action when there is one", s == 200 and (ns.get("election") is None) == (qp["guide"]["action"] is None), ns.get("election"))
    if other:
        s, qp = call("GET", "/api/qpunch/village", login(other["private_id_9digit"], "24024"))
        check("other signs are told when their own month begins", s == 200 and qp["guide"]["role"] == "watch" and "begins on" in qp["guide"]["text"], qp.get("guide"))
    # Libra 2026 on the copy, week by week (dates simulated; nothing here touches the real database)
    W1, W2, W4 = dt.date(2026, 9, 25), dt.date(2026, 10, 5), dt.date(2026, 10, 16)
    rng = random.Random(7)
    lib = E.current_cycle_for_village(con, V, W1)
    check("Libra: nomination 23-30 Sep, voting 1-14 Oct", (lib["zodiac_sign"], lib["nomination_start"], lib["nomination_end"], lib["voting_start"], lib["voting_end"])
          == ("Libra", "2026-09-23", "2026-09-30", "2026-10-01", "2026-10-14"), dict(lib) if lib else None)
    E.auto_nominate(con, V, rng=rng, today=W1); again = E.auto_nominate(con, V, rng=rng, today=W1)
    sm = E.election_summary(con, V, W1)
    check("week 1: 3 male + 3 female Libra candidates, never more", len(sm["candidates"]["male"]) == 3 and len(sm["candidates"]["female"]) == 3 and again == {"male": [], "female": []})
    cand_ok = all(con.execute("SELECT z.sun_sign FROM user_zodiac z WHERE z.user_id = ?", (c["user_id"],)).fetchone()[0] == "Libra"
                  and 25 <= E._age_years(con.execute("SELECT dob FROM users WHERE id = ?", (c["user_id"],)).fetchone()[0], W1) <= 60
                  for g in ("male", "female") for c in sm["candidates"][g])
    check("every candidate is Libra and aged 25-60", cand_ok)
    try:
        E.auto_vote(con, V, rng=rng, today=W1); check("no voting in week 1", False)
    except ValueError:
        check("no voting in week 1", True)
    cast = E.auto_vote(con, V, rng=rng, today=W2); cast2 = E.auto_vote(con, V, rng=rng, today=W2)
    sm2 = E.election_summary(con, V, W2)
    check("weeks 2-3: every eligible Libra member votes once", cast["male"] + cast["female"] == sm2["eligible_voters"] == sm2["turnout"] and cast2["male"] + cast2["female"] == 0, (cast, sm2["eligible_voters"], sm2["turnout"]))
    check("votes stay hidden while voting is open", all(c["votes"] is None for g in ("male", "female") for c in sm2["candidates"][g]))
    bad = con.execute("SELECT COUNT(*) FROM election_votes v JOIN users u ON u.id = v.voter_user_id JOIN user_zodiac z ON z.user_id = u.id "
                      "WHERE v.election_cycle_id = ? AND (z.sun_sign != 'Libra' OR lower(u.gender) != v.gender)", (lib["id"],)).fetchone()[0]
    check("only Libra members voted, men for men and women for women", bad == 0, bad)
    sm4 = E.election_summary(con, V, W4); w = sm4["winners"] or {}
    top = {g: max(c["votes"] for c in sm4["candidates"][g]) for g in ("male", "female")}
    check("week 4: winners have the most votes", sm4["status"] == "closed" and w.get("male_votes") == top["male"] and w.get("female_votes") == top["female"], (w, top))
    check("winners serve 1 year: 15 Oct 2026 - 14 Oct 2027", (w.get("term_start"), w.get("term_end")) == ("2026-10-15", "2027-10-14"), w)
con.close()

# --- website behaviour unchanged, bad tokens refused ---
check("bad token -> 401", call("GET", "/api/me", "not-a-token")[0] == 401)
check("no token -> website login redirect", call("GET", "/api/me")[0] == 302)
web = A.app.test_client()
web.post("/login", json={"private_id": a["private_code"], "pin": "57302"})
check("website dashboard still renders", web.get("/dashboard").status_code == 200)
shutil.rmtree(TMP, ignore_errors=True)
print(f"\n{len(fails)} failed" if fails else "\nALL PASSED")
sys.exit(1 if fails else 0)
