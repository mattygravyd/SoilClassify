import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# colors — mirrors the design tokens in static/style.css so the
# server-rendered chart sits visually flush inside its card.
BG = "#171B1F"        # --surface
PANEL = "#171B1F"      # --surface
PANEL_LINE = "#262C32"  # --border
INK = "#E9E4D8"        # --ink
INK_MUTED = "#6C737B"  # --ink-muted
AMBER = "#E0A254"      # --accent-strong
CLAY = "#A65A42"       # --clay

def classify_soil(p200, p4, ll, pl, cu=None, cc=None):
    pi = ll - pl
    a_line = 0.73 * (ll - 20)

    # fine grained soils
    if p200 >= 50:
        if ll < 50:
            if pi > a_line and pi > 7:
                return "CL", "Lean Clay", pi
            elif pi < a_line or pi < 4:
                return "ML", "Silt", pi
            else:
                return "CL-ML", "Silty Clay", pi
        else:
            if pi >= a_line:
                return "CH", "Fat Clay", pi
            else:
                return "MH", "Elastic Silt", pi

    # coarse grained soils
    retained_4 = 100 - p4
    coarse_fraction = 100 - p200
    is_gravel = retained_4 > (coarse_fraction / 2)
    prefix = "G" if is_gravel else "S"

    if is_gravel:
        is_well_graded = (cu >= 4 and 1 <= cc <= 3) if (cu is not None and cc is not None) else False
    else:
        is_well_graded = (cu >= 6 and 1 <= cc <= 3) if (cu is not None and cc is not None) else False

    grad_symbol = "W" if is_well_graded else "P"

    if pi > a_line and pi > 7:
        fine_symbol = "C"
    elif pi < a_line or pi < 4:
        fine_symbol = "M"
    else:
        fine_symbol = "C-M"

    if p200 < 5:
        symbol = f"{prefix}{grad_symbol}"
        name = f"{'Well' if is_well_graded else 'Poorly'}-graded {'Gravel' if is_gravel else 'Sand'}"
    elif p200 > 12:
        symbol = f"{prefix}{fine_symbol}"
        name = f"{'Clayey' if fine_symbol == 'C' else 'Silty' if fine_symbol == 'M' else 'Silty Clayey'} {'Gravel' if is_gravel else 'Sand'}"
    else:
        symbol = f"{prefix}{grad_symbol}-{prefix}{fine_symbol}"
        name = f"{'Well' if is_well_graded else 'Poorly'}-graded {'Gravel' if is_gravel else 'Sand'} with fines"

    return symbol, name, pi

def generate_plasticity_chart(ll, pi):
    plt.rcParams["font.family"] = "monospace"
    fig, ax = plt.subplots(figsize=(8, 4.6), dpi=140)
    fig.patch.set_facecolor(PANEL)
    ax.set_facecolor(PANEL)

    ll_axis = np.linspace(0, 100, 300)
    a_line = np.maximum(0, 0.73 * (ll_axis - 20))
    u_line = np.maximum(0, 0.9 * (ll_axis - 8))

    ax.plot(ll_axis, a_line, color=INK, linewidth=1.6, label="A-Line")
    ax.plot(ll_axis, u_line, color=CLAY, linestyle="--", linewidth=1.2, alpha=0.85, label="U-Line")
    ax.axvline(50, color=INK_MUTED, linestyle=":", linewidth=1.2, label="Plasticity Boundary")
    ax.axhline(4, color=AMBER, linestyle=":", alpha=0.5)
    ax.axhline(7, color=AMBER, linestyle=":", alpha=0.5)

    ax.scatter(ll, pi, color=AMBER, s=130, zorder=5, edgecolor=INK, linewidth=1, label=f"Sample ({ll}, {pi})")

    ax.text(32, 22, "CL", fontsize=11, fontweight="bold", alpha=0.35, color=INK)
    ax.text(35, 5, "ML", fontsize=11, fontweight="bold", alpha=0.35, color=INK)
    ax.text(70, 45, "CH", fontsize=11, fontweight="bold", alpha=0.35, color=INK)
    ax.text(70, 15, "MH", fontsize=11, fontweight="bold", alpha=0.35, color=INK)
    ax.text(16, 5.5, "CL-ML", fontsize=8, fontweight="bold", alpha=0.4, color=INK)

    ax.set_xlabel("Liquid Limit (LL)", color=INK_MUTED, fontsize=9)
    ax.set_ylabel("Plasticity Index (PI)", color=INK_MUTED, fontsize=9)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 60)
    ax.grid(True, linestyle="--", alpha=0.15, color=INK)
    ax.tick_params(colors=INK_MUTED, labelsize=8)
    for spine in ax.spines.values():
        spine.set_color(PANEL_LINE)

    legend = ax.legend(loc="upper left", fontsize=8, facecolor=PANEL, edgecolor=PANEL_LINE)
    for text in legend.get_texts():
        text.set_color(INK_MUTED)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    buf.seek(0)
    image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close(fig)
    return image_base64

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/classify", methods=["POST"])
def classify():
    data = request.json or {}
    try:
        p200 = float(data.get("p200", 25.0))
        p4 = float(data.get("p4", 75.0))
        ll = float(data.get("ll", 35))
        pl = float(data.get("pl", 20))
        cu = float(data.get("cu")) if data.get("cu") is not None else None
        cc = float(data.get("cc")) if data.get("cc") is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "Sample values must be numbers."}), 400

    symbol, name, pi = classify_soil(p200, p4, ll, pl, cu, cc)
    group = "Coarse-grained" if p200 < 50 else "Fine-grained"
    chart_img = generate_plasticity_chart(ll, pi)

    return jsonify({
        "symbol": symbol,
        "name": name,
        "pi": pi,
        "group": group,
        "chart_img": chart_img
    })

if __name__ == "__main__":
    app.run(debug=True)