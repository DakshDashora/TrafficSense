def calculate_citizen_impact(impact_level: str, is_peak_hour: bool, is_weekend: bool):
    """
    Calculates the impact of an event on citizens: commuters affected, delay minutes,
    economic loss (INR), and emergency response risk (minutes delay).
    """
    # 1. Affected Commuters
    if impact_level == "HIGH":
        base_commuters = 5000
        base_delay = 20
        base_risk = 8
    elif impact_level == "MEDIUM":
        base_commuters = 2000
        base_delay = 10
        base_risk = 4
    else: # LOW
        base_commuters = 500
        base_delay = 5
        base_risk = 2
        
    # Scale based on peak hour or weekend
    commuters = base_commuters
    if is_peak_hour:
        commuters = int(commuters * 1.5)
    if is_weekend:
        commuters = int(commuters * 0.7)
        
    delay = base_delay
    if is_peak_hour:
        delay = int(delay * 1.3)
    if is_weekend:
        delay = int(delay * 0.8)
        
    risk = base_risk
    if is_peak_hour:
        risk += 2
        
    # Economic cost: person-hours-lost * hourly wage rate (assumed ₹150/hr)
    person_hours_lost = (commuters * delay) / 60.0
    economic_loss = int(person_hours_lost * 150.0)
    
    return {
        "commuters_affected": commuters,
        "delay_minutes": delay,
        "economic_loss": economic_loss,
        "emergency_risk": risk
    }
