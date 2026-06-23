// SpeedMoto — Unity (URP) code-driven vertical slice.
//
// Everything (camera, lights, sky, road, bike, traffic, HUD) is built
// procedurally from this single MonoBehaviour, so the only Unity-editor step is:
// create an empty GameObject and add this component. No prefabs/scenes to author.
//
// Controls (faithful to the genre, kept deliberately simple):
//   - Always accelerating.
//   - TILT the phone left/right to steer (auto-calibrated to your hold on start).
//   - Touch the BOTTOM of the screen (thumb zone) to BRAKE.
//   - Editor: arrow keys to steer / brake, Space to retry.
//
// Target: Pixel 9 Pro XL, portrait, 120 Hz. Original work; no third-party assets.

using System.Collections.Generic;
using UnityEngine;

public class SpeedMotoGame : MonoBehaviour
{
    // ---- world constants (metres) -----------------------------------------
    const float LaneWidth = 3.6f;
    const int NumLanes = 3;
    const float RoadWidth = NumLanes * LaneWidth;   // 10.8
    const float RoadHalf = RoadWidth * 0.5f - 0.6f;
    const float SpawnZ = -220f;                     // ahead (forward = -Z)
    const float CullZ = 40f;                        // behind player -> recycle
    const float RoadSeg = 16f;
    const float DashPitch = 7f;

    // ---- tunables ----------------------------------------------------------
    [Range(0.3f, 3f)] public float sensitivity = 1.0f;
    public float tiltRangeDeg = 26f;

    // ---- state -------------------------------------------------------------
    Camera cam;
    Transform player;
    readonly List<Transform> wheels = new List<Transform>();
    readonly List<Transform> roadSegs = new List<Transform>();
    readonly List<Transform> dashes = new List<Transform>();
    readonly List<Vehicle> traffic = new List<Vehicle>();
    readonly List<GameObject> pool = new List<GameObject>();
    float roadWrap, dashWrap;

    float playerX, playerVX;
    float speed = 22f, maxSpeed = 64f, accel = 26f, handling = 22f;
    float distance, best, spawnTimer;
    bool crashed;
    float neutralRoll; bool calibrated;

    Material asphalt, ground, line, edgeLine, bikeBody, rubber, rider, glass;
    readonly Material[] carColors = new Material[5];
    Light sun;

    class Vehicle { public Transform t; public float z, v, w, l; public bool passed; }

    // =======================================================================
    void Start()
    {
        Application.targetFrameRate = 120;
        QualitySettings.vSyncCount = 0;
        if (SystemInfo.supportsGyroscope) Input.gyro.enabled = true;

        BuildMaterials();
        SetupCamera();
        SetupEnvironment();
        BuildRoad();
        BuildPlayer();
        Recalibrate();
    }

    // ---- materials ---------------------------------------------------------
    Material Mat(Color c, float metallic = 0f, float smooth = 0.3f)
    {
        Shader sh = Shader.Find("Universal Render Pipeline/Lit");
        if (sh == null) sh = Shader.Find("Standard");
        var m = new Material(sh);
        if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
        if (m.HasProperty("_Color")) m.SetColor("_Color", c);
        m.color = c;
        if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
        if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smooth);
        if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
        return m;
    }

    void BuildMaterials()
    {
        asphalt  = Mat(new Color(0.22f, 0.22f, 0.24f), 0.0f, 0.4f);
        ground   = Mat(new Color(0.78f, 0.63f, 0.38f), 0f, 0.1f);
        line     = Mat(new Color(0.95f, 0.95f, 0.92f), 0f, 0.2f);
        edgeLine = Mat(new Color(0.95f, 0.82f, 0.2f),  0f, 0.2f);
        bikeBody = Mat(new Color(0.85f, 0.12f, 0.1f),  0.5f, 0.7f);
        rubber   = Mat(new Color(0.05f, 0.05f, 0.06f), 0f, 0.3f);
        rider    = Mat(new Color(0.15f, 0.17f, 0.2f),  0f, 0.4f);
        glass    = Mat(new Color(0.05f, 0.08f, 0.1f),  0.6f, 0.8f);
        Color[] cc = {
            new Color(0.2f,0.4f,0.85f), new Color(0.85f,0.75f,0.1f), new Color(0.85f,0.85f,0.86f),
            new Color(0.15f,0.5f,0.25f), new Color(0.6f,0.15f,0.5f)
        };
        for (int i = 0; i < 5; i++) carColors[i] = Mat(cc[i], 0.4f, 0.6f);
    }

    // ---- camera & environment ---------------------------------------------
    void SetupCamera()
    {
        cam = Camera.main;
        if (cam == null)
        {
            var go = new GameObject("MainCamera");
            cam = go.AddComponent<Camera>();
            go.tag = "MainCamera";
        }
        cam.fieldOfView = 62f;
        cam.nearClipPlane = 0.1f;
        cam.farClipPlane = 1200f;
        cam.transform.position = new Vector3(0, 3.3f, 7.2f);
        cam.transform.rotation = Quaternion.Euler(8f, 180f, 0f); // look toward -Z
    }

    void SetupEnvironment()
    {
        var sunGo = new GameObject("Sun");
        sun = sunGo.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.color = new Color(1f, 0.96f, 0.85f);
        sun.intensity = 1.6f;
        sun.shadows = LightShadows.Soft;
        sunGo.transform.rotation = Quaternion.Euler(48f, 150f, 0f);

        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.55f, 0.65f, 0.8f);
        RenderSettings.ambientEquatorColor = new Color(0.5f, 0.5f, 0.5f);
        RenderSettings.ambientGroundColor = new Color(0.3f, 0.27f, 0.2f);

        var skyShader = Shader.Find("Skybox/Procedural");
        if (skyShader != null)
        {
            var sky = new Material(skyShader);
            if (sky.HasProperty("_SunSize")) sky.SetFloat("_SunSize", 0.05f);
            if (sky.HasProperty("_AtmosphereThickness")) sky.SetFloat("_AtmosphereThickness", 1.0f);
            RenderSettings.skybox = sky;
            RenderSettings.sun = sun;
        }
        else
        {
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.55f, 0.7f, 0.85f);
        }
        DynamicGI.UpdateEnvironment();

        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.Linear;
        RenderSettings.fogColor = new Color(0.78f, 0.82f, 0.85f);
        RenderSettings.fogStartDistance = 120f;
        RenderSettings.fogEndDistance = 700f;
    }

    GameObject Box(Vector3 size, Vector3 pos, Material m, Transform parent, Quaternion? rot = null)
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Destroy(g.GetComponent<Collider>());
        g.transform.localScale = size;
        g.transform.localPosition = pos;
        if (rot.HasValue) g.transform.localRotation = rot.Value;
        if (parent != null) g.transform.SetParent(parent, false);
        g.GetComponent<Renderer>().sharedMaterial = m;
        return g;
    }

    GameObject Cyl(float radius, float width, Vector3 pos, Material m, Transform parent)
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        Destroy(g.GetComponent<Collider>());
        g.transform.localScale = new Vector3(radius * 2, width * 0.5f, radius * 2);
        g.transform.localPosition = pos;
        g.transform.localRotation = Quaternion.Euler(0, 0, 90); // axle along X
        if (parent != null) g.transform.SetParent(parent, false);
        g.GetComponent<Renderer>().sharedMaterial = m;
        return g;
    }

    GameObject Sphere(float d, Vector3 pos, Material m, Transform parent)
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        Destroy(g.GetComponent<Collider>());
        g.transform.localScale = new Vector3(d, d, d);
        g.transform.localPosition = pos;
        if (parent != null) g.transform.SetParent(parent, false);
        g.GetComponent<Renderer>().sharedMaterial = m;
        return g;
    }

    // ---- road --------------------------------------------------------------
    void BuildRoad()
    {
        var gnd = GameObject.CreatePrimitive(PrimitiveType.Plane);
        Destroy(gnd.GetComponent<Collider>());
        gnd.transform.localScale = new Vector3(60, 1, 140);
        gnd.transform.position = new Vector3(0, -0.05f, -300);
        gnd.GetComponent<Renderer>().sharedMaterial = ground;

        int n = Mathf.CeilToInt((CullZ - SpawnZ + 60) / RoadSeg) + 1;
        roadWrap = n * RoadSeg;
        for (int i = 0; i < n; i++)
        {
            float z = CullZ - i * RoadSeg;
            var road = Box(new Vector3(RoadWidth + 0.4f, 0.1f, RoadSeg), new Vector3(0, 0, z), asphalt, null);
            roadSegs.Add(road.transform);
            Box(new Vector3(0.18f, 0.12f, RoadSeg), new Vector3(-(RoadWidth * 0.5f - 0.2f), 0.06f, 0), edgeLine, road.transform);
            Box(new Vector3(0.18f, 0.12f, RoadSeg), new Vector3(RoadWidth * 0.5f - 0.2f, 0.06f, 0), edgeLine, road.transform);
        }

        float[] edges = { -LaneWidth * 0.5f, LaneWidth * 0.5f };
        int dn = Mathf.CeilToInt((CullZ - SpawnZ + 40) / DashPitch) + 1;
        dashWrap = dn * DashPitch;
        foreach (float ex in edges)
            for (int i = 0; i < dn; i++)
            {
                float z = CullZ - i * DashPitch;
                dashes.Add(Box(new Vector3(0.16f, 0.13f, 2.6f), new Vector3(ex, 0.06f, z), line, null).transform);
            }
    }

    void Scroll(List<Transform> list, float wrap, float dz)
    {
        for (int i = 0; i < list.Count; i++)
        {
            var t = list[i];
            var p = t.position;
            p.z += dz;
            if (p.z > CullZ) p.z -= wrap;
            t.position = p;
        }
    }

    // ---- player bike -------------------------------------------------------
    void BuildPlayer()
    {
        var p = new GameObject("Player").transform;
        p.position = Vector3.zero;
        Box(new Vector3(0.5f, 0.45f, 1.6f), new Vector3(0, 0.75f, 0), bikeBody, p);
        Box(new Vector3(0.45f, 0.18f, 0.7f), new Vector3(0, 1.0f, 0.15f), rider, p);
        wheels.Add(Cyl(0.34f, 0.16f, new Vector3(0, 0.34f, -0.78f), rubber, p).transform);
        wheels.Add(Cyl(0.34f, 0.16f, new Vector3(0, 0.34f, 0.78f), rubber, p).transform);
        Box(new Vector3(0.4f, 0.55f, 0.3f), new Vector3(0, 1.35f, 0.05f), rider, p);
        Sphere(0.34f, new Vector3(0, 1.75f, -0.05f), rider, p);
        player = p;
    }

    GameObject MakeCar(int kind, Material col, out float w, out float l)
    {
        w = 1.8f; l = 4.4f; float h = 1.4f;
        if (kind == 1) { w = 2.0f; l = 5.2f; h = 2.2f; }
        if (kind == 2) { w = 2.5f; l = 9f; h = 3.4f; }
        var g = new GameObject("car");
        Box(new Vector3(w, h, l), new Vector3(0, h * 0.5f, 0), col, g.transform);
        if (kind == 0) Box(new Vector3(w * 0.9f, h * 0.6f, l * 0.5f), new Vector3(0, h * 0.95f, -0.1f), glass, g.transform);
        Cyl(0.36f, 0.2f, new Vector3(-w * 0.5f, 0.36f, l * 0.32f), rubber, g.transform);
        Cyl(0.36f, 0.2f, new Vector3(w * 0.5f, 0.36f, l * 0.32f), rubber, g.transform);
        Cyl(0.36f, 0.2f, new Vector3(-w * 0.5f, 0.36f, -l * 0.32f), rubber, g.transform);
        Cyl(0.36f, 0.2f, new Vector3(w * 0.5f, 0.36f, -l * 0.32f), rubber, g.transform);
        return g;
    }

    // ---- input -------------------------------------------------------------
    void Recalibrate() { neutralRoll = CurrentRoll(); calibrated = true; }

    // gravity-projected roll: stable at any hold pitch ("play from any position").
    float CurrentRoll()
    {
        Vector3 a = Input.acceleration;
        if (a.sqrMagnitude < 0.01f) return neutralRoll;
        return Mathf.Atan2(a.x, -a.y) * Mathf.Rad2Deg;
    }

    void ReadInput(out float steer, out float brake)
    {
        steer = 0f; brake = 0f;
        if (!calibrated) Recalibrate();
        float roll = Mathf.DeltaAngle(neutralRoll, CurrentRoll());
        float range = tiltRangeDeg / Mathf.Max(0.3f, sensitivity);
        steer = Mathf.Clamp(roll / range, -1f, 1f);

        for (int i = 0; i < Input.touchCount; i++)
            if (Input.GetTouch(i).position.y < Screen.height * 0.28f) brake = 1f; // thumb zone

#if UNITY_EDITOR
        if (Input.GetKey(KeyCode.LeftArrow)) steer = -1f;
        if (Input.GetKey(KeyCode.RightArrow)) steer = 1f;
        if (Input.GetKey(KeyCode.DownArrow)) brake = 1f;
#endif
    }

    // ---- main loop ---------------------------------------------------------
    void Update()
    {
        float dt = Mathf.Min(Time.deltaTime, 0.05f);

        if (crashed)
        {
            if (Input.touchCount > 0 || Input.GetKeyDown(KeyCode.Space)) ResetRun();
            return;
        }

        ReadInput(out float steer, out float brake);

        float want = maxSpeed;
        if (brake > 0) want = Mathf.Max(8f, maxSpeed - brake * 42f);
        speed = Mathf.MoveTowards(speed, want, accel * dt);
        distance += speed * dt;
        float diff = Mathf.Clamp01(distance / 3000f);
        float dz = speed * dt;

        // lateral
        float targetVX = steer * handling;
        playerVX = Mathf.Lerp(playerVX, targetVX, Mathf.Min(1f, dt * 10f));
        playerX = Mathf.Clamp(playerX + playerVX * dt, -RoadHalf, RoadHalf);
        if (player != null)
        {
            var pp = player.position; pp.x = playerX; pp.y = Mathf.Sin(Time.time * 22f) * 0.012f; player.position = pp;
            player.rotation = Quaternion.Euler(0, 0, -Mathf.Clamp(playerVX / handling, -1f, 1f) * 18f);
            float spin = dz / 0.34f * Mathf.Rad2Deg;
            for (int i = 0; i < wheels.Count; i++) wheels[i].Rotate(Vector3.right, spin, Space.Self);
        }

        Scroll(roadSegs, roadWrap, dz);
        Scroll(dashes, dashWrap, dz);

        spawnTimer -= dt;
        if (spawnTimer <= 0f) { spawnTimer = Mathf.Lerp(1.15f, 0.4f, diff) * Random.Range(0.7f, 1.3f); SpawnTraffic(diff); }

        for (int i = traffic.Count - 1; i >= 0; i--)
        {
            var o = traffic[i];
            o.z += (speed - o.v) * dt;
            var tp = o.t.position; tp.z = o.z; o.t.position = tp;
            if (!o.passed && o.z > -2.1f && o.z < 2.1f &&
                Mathf.Abs(o.t.position.x - playerX) < (o.w + 0.95f) * 0.5f && Mathf.Abs(o.z) < (o.l + 2.1f) * 0.5f)
            { crashed = true; return; }
            if (o.z > 0f) o.passed = true;
            if (o.z > CullZ) { o.t.gameObject.SetActive(false); pool.Add(o.t.gameObject); traffic.RemoveAt(i); }
        }

        if (cam != null)
        {
            float s01 = Mathf.Clamp01(speed / 90f);
            cam.transform.position = Vector3.Lerp(cam.transform.position,
                new Vector3(playerX * 0.5f, 3.3f, 7.2f + s01 * 1.1f), Mathf.Min(1f, dt * 6f));
            cam.fieldOfView = 60f + s01 * 6f;
        }

        if (distance > best) best = distance;
    }

    void SpawnTraffic(float diff)
    {
        int kind = Random.value < 0.6f ? 0 : (Random.value < 0.5f ? 1 : 2);
        int lane = Random.Range(0, NumLanes);
        float w, l;
        GameObject g;
        if (pool.Count > 0) { g = pool[pool.Count - 1]; pool.RemoveAt(pool.Count - 1); g.SetActive(true); w = 1.8f; l = 4.4f; }
        else g = MakeCar(kind, carColors[Random.Range(0, 5)], out w, out l);
        // pooled cars reuse their original shape; approximate footprint for collision
        float x = (lane - 1) * LaneWidth;
        float z = SpawnZ - Random.Range(0f, 40f);
        g.transform.position = new Vector3(x, 0, z);
        traffic.Add(new Vehicle { t = g.transform, z = z, v = 8f + Random.Range(0f, 10f) + diff * 6f, w = w, l = l, passed = false });
    }

    void ResetRun()
    {
        crashed = false; speed = 22f; distance = 0f; playerX = 0f; playerVX = 0f; spawnTimer = 0f;
        for (int i = traffic.Count - 1; i >= 0; i--) { traffic[i].t.gameObject.SetActive(false); pool.Add(traffic[i].t.gameObject); }
        traffic.Clear();
        Recalibrate();
    }

    // ---- minimal HUD (swap for UI Toolkit once the slice is confirmed) -----
    GUIStyle big, small;
    void OnGUI()
    {
        if (big == null)
        {
            big = new GUIStyle(GUI.skin.label) { fontSize = Mathf.RoundToInt(Screen.height * 0.05f), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            small = new GUIStyle(GUI.skin.label) { fontSize = Mathf.RoundToInt(Screen.height * 0.03f), fontStyle = FontStyle.Bold };
        }
        big.normal.textColor = Color.white; small.normal.textColor = Color.white;
        GUI.Label(new Rect(24, 24, 600, 80), Mathf.FloorToInt(distance) + " m", small);
        GUI.Label(new Rect(Screen.width - 340, Screen.height - 150, 320, 110), Mathf.RoundToInt(speed * 3.6f) + " km/h", big);
        if (crashed)
            GUI.Label(new Rect(0, Screen.height * 0.4f, Screen.width, 160),
                "CRASHED\nbest " + Mathf.FloorToInt(best) + " m\n(tap to retry)", big);
    }
}
